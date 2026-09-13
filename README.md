[🇬🇧 English](#english) · [🇨🇿 Čeština](#čeština)

# English

GitHub Action that **builds** your Docker images and **uploads** your app to [Tour de Cloud](https://tourde.cloud) for the Tour de App competition.

## Usage

1. Add a `TDC_TOKEN` secret to your repository ([how?](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-a-repository)).
2. Add a `tourdeapp.yaml` file to the root of your repository, see [Configuration](#configuration).
3. Create `.github/workflows/deploy.yml`:

    ```yaml
    name: Deploy to Tour de App

    on:
      push:
        branches:
          - main

    permissions:
      contents: read

    jobs:
      deploy:
        runs-on: ubuntu-latest
        steps:
          - name: Check out repository
            uses: actions/checkout@v7

          - name: Upload to Tour de Cloud
            uses: studentscangrow/upload-app@v27
            with:
              tdc_token: ${{ secrets.TDC_TOKEN }}
    ```

    Every push to `main` builds and uploads your app. You can change the branch to any other.

Docker layers are cached in the GitHub Actions cache automatically, so repeated builds are faster.

### Inputs

| Input         | Required | Default                       | Description                                                  |
| ------------- | -------- | ----------------------------- | ------------------------------------------------------------ |
| `tdc_token`   | yes      |                               | Tour de Cloud team API token                                 |
| `api_url`     | no       | `https://tourde.cloud/api/v2` | Tour de Cloud API URL                                        |
| `config_path` | no       | `tourdeapp.yaml`              | Path to the configuration file                               |
| `debug`       | no       | `false`                       | Log API requests and responses, see [Debug logs](#debug-logs) |

### Outputs

| Output       | Description                                   |
| ------------ | --------------------------------------------- |
| `upload_id`  | Identifier of the upload                      |
| `images`     | JSON array of the pushed images               |
| `deployable` | `true` when the uploaded app can be deployed  |

## Configuration

`tourdeapp.yaml` describes the containers of your app and how to build their images. The full specification is the [JSON schema](https://tourde.cloud/api/v2/schema). Keep the first line of the example to get autocomplete in your editor.

```yaml
# $schema: https://tourde.cloud/api/v2/schema
exposedPort: 80
containers:
  - name: web
    image: registry.tourde.cloud/<team-slug>/web
    port: 80
  - name: server
    image: registry.tourde.cloud/<team-slug>/server
    port: 8080
build:
  - name: web
    context: ./frontend
  - name: server
    context: ./backend
    dockerfile: ./backend/docker/Dockerfile
    args:
      API_URL: https://example.com/api
```

Each item in `build` produces one image. `context` defaults to `.` and `dockerfile` defaults to `Dockerfile` inside the context. All paths are relative to the root of the repository, even when you use a different `config_path`.

## Environment variable substitution

Anywhere in `tourdeapp.yaml` you can write `{{VARIABLE}}` and the action replaces it with the value of the environment variable `VARIABLE`. Pass the variable to the step with `env`:

```yaml
- name: Upload to Tour de Cloud
  uses: studentscangrow/upload-app@v27
  env:
    API_KEY: ${{ secrets.API_KEY }}
  with:
    tdc_token: ${{ secrets.TDC_TOKEN }}
```

```yaml
build:
  - name: web
    context: ./frontend
    args:
      API_KEY: "{{API_KEY}}"
```

If a variable is missing, the upload fails.

## Debug logs

Set `debug: true` to print every request sent to Tour de Cloud and every response. The same logs also appear when you re-run a job with **Enable debug logging**. The configuration file is printed before substitution, so values of `{{VARIABLE}}` placeholders are not shown.

```yaml
- name: Upload to Tour de Cloud
  uses: studentscangrow/upload-app@v27
  with:
    tdc_token: ${{ secrets.TDC_TOKEN }}
    debug: true
```

# Čeština

GitHub akce, která **sestaví** tvoje Docker obrazy a **nahraje** aplikaci do [Tour de Cloud](https://tourde.cloud) v rámci soutěže Tour de App.

## Jak na to

1. V nastavení repozitáře vytvoř secret `TDC_TOKEN` ([jak?](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-a-repository)).
2. Do kořenového adresáře repozitáře přidej soubor `tourdeapp.yaml`, viz [Konfigurace](#konfigurace).
3. Vytvoř soubor `.github/workflows/deploy.yml`:

    ```yaml
    name: Deploy to Tour de App

    on:
      push:
        branches:
          - main

    permissions:
      contents: read

    jobs:
      deploy:
        runs-on: ubuntu-latest
        steps:
          - name: Check out repository
            uses: actions/checkout@v7

          - name: Upload to Tour de Cloud
            uses: studentscangrow/upload-app@v27
            with:
              tdc_token: ${{ secrets.TDC_TOKEN }}
    ```

    Každý push do větve `main` aplikaci sestaví a nahraje. Větev můžeš změnit na jakoukoli jinou.

Vrstvy Docker obrazů se automaticky ukládají do cache GitHub Actions, takže opakovaná sestavení jsou rychlejší.

### Vstupy

| Vstup         | Povinný | Výchozí hodnota               | Popis                                                          |
| ------------- | ------- | ----------------------------- | -------------------------------------------------------------- |
| `tdc_token`   | ano     |                               | API token týmu v Tour de Cloud                                 |
| `api_url`     | ne      | `https://tourde.cloud/api/v2` | URL API Tour de Cloud                                          |
| `config_path` | ne      | `tourdeapp.yaml`              | Cesta ke konfiguračnímu souboru                                |
| `debug`       | ne      | `false`                       | Vypisuje požadavky a odpovědi API, viz [Ladicí výpisy](#ladicí-výpisy) |

### Výstupy

| Výstup       | Popis                                         |
| ------------ | --------------------------------------------- |
| `upload_id`  | Identifikátor nahrání                         |
| `images`     | JSON pole nahraných obrazů                    |
| `deployable` | `true`, pokud lze nahranou aplikaci nasadit   |

## Konfigurace

`tourdeapp.yaml` popisuje kontejnery tvé aplikace a jak sestavit jejich obrazy. Úplná specifikace je v [JSON schématu](https://tourde.cloud/api/v2/schema). Když v souboru necháš první řádek z příkladu, editor ti bude napovídat.

```yaml
# $schema: https://tourde.cloud/api/v2/schema
exposedPort: 80
containers:
  - name: web
    image: registry.tourde.cloud/<team-slug>/web
    port: 80
  - name: server
    image: registry.tourde.cloud/<team-slug>/server
    port: 8080
build:
  - name: web
    context: ./frontend
  - name: server
    context: ./backend
    dockerfile: ./backend/docker/Dockerfile
    args:
      API_URL: https://example.com/api
```

Každá položka v `build` vytvoří jeden obraz. `context` je ve výchozím stavu `.` a `dockerfile` je `Dockerfile` uvnitř contextu. Všechny cesty jsou relativní ke kořeni repozitáře, i když použiješ jiný `config_path`.

## Nahrazování proměnných prostředí

Kdekoli v `tourdeapp.yaml` můžeš napsat `{{PROMENNA}}` a akce to nahradí hodnotou proměnné prostředí `PROMENNA`. Proměnnou předej kroku přes `env`:

```yaml
- name: Upload to Tour de Cloud
  uses: studentscangrow/upload-app@v27
  env:
    API_KEY: ${{ secrets.API_KEY }}
  with:
    tdc_token: ${{ secrets.TDC_TOKEN }}
```

```yaml
build:
  - name: web
    context: ./frontend
    args:
      API_KEY: "{{API_KEY}}"
```

Pokud proměnná chybí, nahrání selže.

## Ladicí výpisy

Nastav `debug: true` a akce vypíše každý požadavek odeslaný do Tour de Cloud i každou odpověď. Stejné výpisy se zobrazí i při opětovném spuštění jobu s volbou **Enable debug logging**. Konfigurační soubor se vypisuje před nahrazením proměnných, takže hodnoty `{{PROMENNA}}` ve výpisu nejsou.

```yaml
- name: Upload to Tour de Cloud
  uses: studentscangrow/upload-app@v27
  with:
    tdc_token: ${{ secrets.TDC_TOKEN }}
    debug: true
```
