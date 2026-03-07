# API Catalog

A curated library of public APIs suitable for building simple browser-based applications hosted on **GitHub Pages** or **Netlify**. The project includes a structured dataset of over 50 APIs and a lightweight, searchable web interface with a built-in API explorer.

This project was created to provide developers, students, and hobbyists with a quick and easy way to find free, well-documented APIs that can be used directly from client-side JavaScript without requiring complex server-side proxies or authentication flows.

## Project Structure

The repository is organized as follows:

```
api-catalog/
├── README.md           # This file
├── data/
│   └── apis.json       # The core dataset of all APIs
├── docs/
│   └── categories.md   # Guide to the API categories
└── web/
    ├── index.html      # Main HTML file for the web interface
    ├── app.js          # JavaScript application logic
    └── style.css       # CSS stylesheet
```

## Dataset Structure (`data/apis.json`)

The `apis.json` file contains an array of API objects, each with the following structure:

| Key                  | Type      | Description                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------------- |
| `id`                 | `Number`  | A unique integer ID for the API entry.                                      |
| `name`               | `String`  | The common name of the API.                                                 |
| `category`           | `String`  | The primary category the API belongs to (e.g., "Weather & Environment").    |
| `description`        | `String`  | A short, clear description of what the API does.                            |
| `auth_type`          | `String`  | Authentication method (`none`, `apiKey`, `OAuth`).                          |
| `cors`               | `Boolean` | Indicates if the API supports CORS for browser-based requests.              |
| `free_tier_limits`   | `String`  | A summary of the limits for the free tier.                                  |
| `rate_limits`        | `String`  | Information on request rate limits.                                         |
| `base_url`           | `String`  | The base URL for making API calls.                                          |
| `example_endpoint`   | `String`  | A full example URL for a typical request.                                   |
| `example_params`     | `Object`  | An object containing example query parameters.                              |
| `response_format`    | `String`  | The expected data format of the response (e.g., `JSON`).                    |
| `docs_url`           | `String`  | A direct link to the official API documentation.                            |
| `use_cases`          | `Array`   | An array of strings describing typical use cases.                           |
| `notes`              | `String`  | Additional notes, including tips for browser usage or key requirements.     |
| `cors_testable`      | `Boolean` | A flag to enable/disable the API Explorer based on reliable CORS support.   |

## Adding New APIs

To contribute a new API to the catalog, follow these steps:

1.  **Fork the repository.**
2.  **Open `data/apis.json`** in a text editor.
3.  **Add a new JSON object** to the `apis` array, following the structure outlined above.
4.  **Assign a new unique `id`**. This should be the next sequential integer.
5.  **Fill in all the fields** as accurately as possible. Pay special attention to `cors` and `auth_type` as these are critical for browser-based apps.
6.  **Set `cors_testable` to `true`** only if you have successfully tested the API's example endpoint directly from a browser environment.
7.  **Submit a pull request** with your changes.

## How to Use the Web Interface

No build step is required. You can run the web interface locally using any simple static file server.

1.  **Navigate to the project root directory** in your terminal.
2.  **Start a local server.** A simple way is to use `npx`:

    ```bash
    npx serve
    ```

3.  **Open your browser** and go to the local address provided by the server (e.g., `http://localhost:3000/web/`).

## Deployment

This project is designed for easy deployment to static hosting services like GitHub Pages or Netlify.

### Deploying to GitHub Pages

1.  **Push the repository to GitHub.**
2.  Go to your repository's **Settings** tab.
3.  In the left sidebar, click on **Pages**.
4.  Under "Build and deployment", select the **Source** as **Deploy from a branch**.
5.  Choose the `main` (or `master`) branch and the `/ (root)` folder.
6.  Click **Save**.

Your site will be live at `https://<your-username>.github.io/<repository-name>/web/` within a few minutes.

### Deploying to Netlify

1.  **Push the repository to GitHub.**
2.  **Sign up or log in** to your [Netlify](https://www.netlify.com/) account.
3.  From your dashboard, click **Add new site** > **Import an existing project**.
4.  **Connect to GitHub** and authorize Netlify to access your repositories.
5.  **Select the `api-catalog` repository.**
6.  Netlify will automatically detect the settings. Since there is no build step, you can leave the default settings.
7.  Click **Deploy site**.

Netlify will deploy your site and provide you with a public URL.
