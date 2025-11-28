# Webpage Schema Builder Chrome Extension

A beautiful Chrome extension that generates JSON-LD schema markup for multiple webpages using Google's Gemini AI. Features a modern glassmorphism design and batch processing capabilities.

## Features

- ✨ **Glassmorphism UI** - Modern, clean design with frosted glass effects
- 🤖 **AI-Powered** - Uses Google's Gemini Flash models to generate SEO-optimized schemas
- 📊 **Batch Processing** - Process up to 20 URLs from a CSV file
- 📄 **Multiple Formats** - Download individual or all schemas as TXT or JSON
- 🔍 **Smart Extraction** - Automatically extracts page content, FAQs, and metadata
- 🎯 **Keyword Support** - Include seed keywords for better schema generation
- 📋 **One-Click Copy** - Copy schema to clipboard instantly
- 📈 **Progress Tracking** - Real-time progress bar and status updates

## Installation

1. **Download the Source Code**
   - **Option A (Git Users):** Clone the repository
     ```bash
     git clone <repository-url>
     cd WebPageSchema
     ```
   - **Option B (Non-Git Users):**
     - Click the green **"Code"** button at the top of the GitHub page.
     - Select **"Download ZIP"**.
     - Extract the ZIP file to a folder on your computer.

2. **Get a Google AI Studio API Key**
   - Visit [https://aistudio.google.com/app/api-keys](https://aistudio.google.com/app/api-keys)
   - Create a new API key
   - Copy the key (you'll enter it in the extension)

3. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the extension directory


## Usage

1. **Open the extension**
   - Click the extension icon in your Chrome toolbar
   - A new tab will open with the Schema Builder interface

2. **Enter your API key**
   - Paste your Google AI Studio API key
   - The key will be saved for future use

3. **Upload CSV file**
   - Click the upload area or drag and drop a CSV file
   - CSV format: `url,primary_keywords`
   - Maximum 20 URLs per batch
   - Example:
     ```csv
     url,primary_keywords
     https://example.com/page1,keyword1 keyword2
     https://example.com/page2,keyword3 keyword4
     ```

4. **Start processing**
   - Click "Start Processing"
   - Watch the progress bar as each URL is processed
   - Results appear in real-time

5. **View and export results**
   - Each result shows the URL, status, and generated schema
   - Use individual buttons to copy or download each schema
   - Use "Download All" buttons to export all successful schemas

## CSV Format

Your CSV file should have the following structure:

```csv
url,primary_keywords
https://www.example.com/page1,keyword1 keyword2
https://www.example.com/page2,keyword3 keyword4
https://www.example.com/page3,keyword5
```

- **url** (required): The full URL of the webpage
- **primary_keywords** (optional): Comma or semicolon-separated keywords

The extension will automatically:
- Limit to 20 URLs (first 20 if more are provided)
- Validate URLs
- Parse keywords from the keywords column

## Generated Schema Includes

- **WebPage** type with URL and metadata
- **Description** - AI-generated page description
- **Keywords** - SEO keywords (from seed keywords + AI suggestions)
- **Publisher** - Organization information
- **About** - Topics and entities the page covers
- **FAQs** - If detected on the page

## Permissions

The extension requires:
- `activeTab` - To access the current page's content (if needed)
- `storage` - To save your API key
- `scripting` - To extract page content
- `tabs` - To open the extension in a new tab
- `host_permissions` - To call the Gemini API and fetch pages

## Privacy

- Your API key is stored locally in Chrome's storage
- Page content is sent to Google's Gemini API for processing
- No data is stored on external servers
- The extension only accesses pages you explicitly process

## Troubleshooting

**Extension won't open?**
- Click the extension icon in the toolbar
- Check that all files are in the correct location
- Reload the extension in `chrome://extensions/`

**"API error" message**
- Verify your API key is correct
- Check that you have API access enabled
- Ensure you have quota remaining
- Try using a different model from the [Gemini models page](https://ai.google.dev/gemini-api/docs/models) in `app.js`

**"Failed to fetch page"**
- The URL might be blocked by CORS
- Some pages may require authentication
- Check the URL is accessible

**CSV parsing errors**
- Ensure your CSV has a `url` column
- Check that URLs are valid (start with http:// or https://)
- Verify the file is saved as `.csv` format

**Schema not generating**
- Check browser console for errors (F12)
- Verify the page has extractable content
- Try a different URL
- Check your API quota


## Contributing
 
 We welcome contributions! If you'd like to help improve this extension, please check out our [Contribution Guidelines](CONTRIBUTING.md).
 
 ## License

MIT License - feel free to modify and distribute.

## Credits

- Powered by Google Gemini AI
- Design inspired by glassmorphism UI trends
- Built for SEO professionals and web developers
