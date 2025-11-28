# Contributing to Webpage Schema Builder

Thank you for your interest in contributing to the Webpage Schema Builder extension! We welcome contributions from the community to help improve this tool.

## How to Contribute

### Reporting Bugs

If you find a bug, please create a new issue in the repository. Be sure to include:
- A clear title and description of the issue.
- Steps to reproduce the bug.
- Expected behavior vs. actual behavior.
- Screenshots or error logs if applicable.
- Your browser version and OS.

### Suggesting Enhancements

Have an idea for a new feature or improvement? Open an issue and tag it as an "enhancement". Describe your idea in detail and how it would benefit users.

### Pull Requests

We welcome pull requests for bug fixes and new features. Please follow these steps:

1.  **Fork the repository** to your own GitHub account.
2.  **Clone the repository** to your local machine.
    ```bash
    git clone https://github.com/YOUR_USERNAME/WebPageSchema.git
    cd WebPageSchema
    ```
3.  **Create a new branch** for your feature or bug fix.
    ```bash
    git checkout -b feature/your-feature-name
    ```
4.  **Make your changes** and test them thoroughly.
5.  **Commit your changes** with clear and descriptive commit messages.
    ```bash
    git commit -m "Add feature: description of your feature"
    ```
6.  **Push your branch** to your forked repository.
    ```bash
    git push origin feature/your-feature-name
    ```
7.  **Open a Pull Request** (PR) from your forked repository to the main repository. Provide a clear description of your changes and reference any related issues.

## Development Guidelines

-   **Code Style**: Please follow the existing code style and formatting.
-   **Testing**: Test your changes manually to ensure they work as expected.
-   **Documentation**: Update the README or other documentation if your changes affect how to use or install the extension.

## File Structure

```
WebPageSchema/
├── manifest.json       # Extension manifest
├── index.html         # Main extension interface
├── styles.css         # Glassmorphism styles
├── app.js             # Main extension logic
├── background.js      # Service worker for API calls
├── content.js         # Content script
├── icons/             # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md          # This file
├── QUICKSTART.md      # Quick start guide
└── create-icons.html  # Icon generator tool
```

## Development

### Customization

**Change AI Model**
- Edit `MODEL` constant in `app.js` (line ~50)
- Any of the latest Gemini Flash models will work. You can view the available models [here](https://ai.google.dev/gemini-api/docs/models).

**Modify URL Limit**
- Edit `MAX_URLS` constant in `app.js` (line ~49)

**Modify Styling**
- Edit `styles.css` for colors, sizes, effects
- Glassmorphism is achieved via `backdrop-filter: blur()`

**Adjust Content Extraction**
- Modify `parseHTML()` in `background.js`

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
