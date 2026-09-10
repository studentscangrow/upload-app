import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { basename } from 'node:path'
import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'

type BuildItem = {
  name: string
  context?: string
  dockerfile?: string
  args?: Record<string, string>
}

const log = /^true$/i.test(core.getInput('debug')) ? core.info : core.debug

function substituteEnv(source: string): string {
  return source.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (_match, name: string) => {
    const value = process.env[name]
    if (value === undefined) throw new Error(`missing env var: ${name}`)
    return value
  })
}

function describeFormData(body: FormData): Record<string, unknown> {
  const described: Record<string, unknown> = {}
  for (const [key, value] of body.entries()) {
    const entry =
      typeof value === 'string'
        ? value
        : { kind: 'file', name: value.name, type: value.type || '(none)', size: value.size }

    if (key in described) {
      const existing = described[key]
      described[key] = Array.isArray(existing) ? [...existing, entry] : [existing, entry]
    } else {
      described[key] = entry
    }
  }
  return described
}

async function post(url: string, token: string, body: FormData) {
  log(`→ POST ${url}`)
  log(`→ request body: ${JSON.stringify(describeFormData(body), null, 2)}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  })

  const responseText = await res.text()
  log(`← response status: ${res.status} ${res.statusText}`)
  log(`← response headers: ${JSON.stringify(Object.fromEntries(res.headers.entries()), null, 2)}`)
  log(`← response body: ${responseText || '(empty)'}`)

  let data: any
  try {
    data = responseText ? JSON.parse(responseText) : {}
  } catch {
    throw new Error(
      `request failed: ${res.status} (non-JSON response): ${responseText.slice(0, 500)}`,
    )
  }

  if (!res.ok) {
    const error = data.error
    if (error?.code) core.error(`[${error.code}] ${error.message}`)
    if (error?.why) core.error(`Why: ${error.why}`)
    if (error?.fix) core.error(`Fix: ${error.fix}`)
    if (error?.link) core.error(error.link)

    if (Array.isArray(data.globalErrors)) {
      for (const message of data.globalErrors) {
        core.error(message)
      }
    }

    if (data.fieldErrors && typeof data.fieldErrors === 'object') {
      for (const [field, message] of Object.entries(data.fieldErrors)) {
        core.error(`${field}: ${message}`)
      }
    }

    if (error?.detail) {
      core.error(JSON.stringify(error.detail, null, 2))
    }

    throw new Error(error?.message ?? `request failed: ${res.status}`)
  }
  return data
}

async function main() {
  const token = core.getInput('tdc_token', { required: true })
  core.setSecret(token)

  const apiUrl = core.getInput('api_url').replace(/\/+$/, '')
  const configPath = core.getInput('config_path')

  const source = readFileSync(configPath, 'utf8')
  log(`config before substitution (${configPath}):\n${source}`)
  const yaml = substituteEnv(source)
  const manifest = parseYaml(yaml) as { build: BuildItem[] }
  const builds = manifest.build

  const preflight = new FormData()
  preflight.append(
    'yamlConfig',
    new File([yaml], basename(configPath), { type: 'application/x-yaml' }),
  )
  preflight.append('repository', process.env.GITHUB_REPOSITORY!)
  preflight.append('commitSha', process.env.GITHUB_SHA!)
  preflight.append('githubRunId', process.env.GITHUB_RUN_ID!)
  preflight.append('branch', process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME!)

  core.info('Calling upload preflight…')
  const pre = await post(`${apiUrl}/upload/preflight`, token, preflight)
  core.info(`Preflight OK: uploadId=${pre.uploadId}, teamSlug=${pre.teamSlug}, commitShaShort=${pre.commitShaShort}`)

  const registry = String(pre.registryUrl)
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')

  const images: string[] = []
  let error: Error | undefined

  try {
    await exec.exec('docker', ['login', registry, '--username', 'tdc', '--password-stdin'], {
      input: Buffer.from(token),
    })
    // gha cache needs a non-default builder; ACTIONS_RUNTIME_TOKEN/ACTIONS_RESULTS_URL come from the runner env
    await exec.exec('docker', ['buildx', 'create', '--driver', 'docker-container', '--use'])

    for (const item of builds) {
      const image = `${registry}/${pre.teamSlug}/${item.name}:${pre.commitShaShort}`
      const cache = `type=gha,scope=${item.name}`
      const args = [
        'buildx', 'build', '-t', image, '--push',
        '--cache-from', cache,
        '--cache-to', `${cache},mode=max,ignore-error=true`,
      ]

      if (item.dockerfile) args.push('-f', item.dockerfile)

      if (item.args) {
        for (const [key, value] of Object.entries(item.args)) {
          args.push('--build-arg', `${key}=${value}`)
        }
      }

      args.push(item.context ?? '.')

      await exec.exec('docker', args)
      images.push(image)
    }
  } catch (e) {
    error = e instanceof Error ? e : new Error(String(e))
  }

  const completeBody = new FormData()
  completeBody.append('uploadId', String(pre.uploadId))
  completeBody.append('status', error ? 'failed' : 'success')
  for (const image of images) {
    completeBody.append('images', image)
  }
  if (error) {
    completeBody.append('failureReason', error.message)
  }

  core.info(`Calling upload complete (status=${error ? 'failed' : 'success'}, images=${images.length})…`)
  const complete = await post(`${apiUrl}/upload/complete`, token, completeBody)
  core.info(`Complete OK: status=${complete.status}, deployable=${complete.deployable}`)

  core.setOutput('upload_id', String(pre.uploadId))
  core.setOutput('images', JSON.stringify(images))
  core.setOutput('deployable', String(complete.deployable === true))

  if (error) throw error
  if (complete.status !== 'success' || complete.deployable !== true) {
    throw new Error(`upload not deployable (status=${complete.status})`)
  }
}

main().catch((e) => core.setFailed(e instanceof Error ? e.message : String(e)))
