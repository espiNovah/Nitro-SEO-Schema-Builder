# Quick Start Guide

## 1. Generate Icons (Optional but Recommended)

Open `create-icons.html` in your browser and click "Generate All Icons" to create the required icon files. Save them in the `icons/` folder.

Alternatively, you can use any image editor to create:
- `icon16.png` (16x16)
- `icon48.png` (48x48)  
- `icon128.png` (128x128)

## 2. Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the `WebPageSchema` folder

## 3. Get API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/api-keys)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

## 4. Use the Extension

1. **Open the extension**
   - Click the extension icon in your Chrome toolbar
   - A new tab will open with the Schema Builder

2. **Enter your API key**
   - Paste your API key (saved automatically)

3. **Prepare your CSV file**
   - Create a CSV with columns: `url,primary_keywords`
   - Maximum 20 URLs
   - Example:
     ```csv
     url,primary_keywords
     https://example.com/page1,keyword1 keyword2
     https://example.com/page2,keyword3
     ```

4. **Upload and process**
   - Click the upload area or drag & drop your CSV
   - Click "Start Processing"
   - Watch the progress bar
   - View results as they complete

5. **Export results**
   - Copy individual schemas with the Copy button
   - Download individual schemas as TXT or JSON
   - Download all successful schemas at once

## CSV Format

Your CSV should look like this:

```csv
url,primary_keywords
https://www.example.com/page1,keyword1 keyword2 keyword3
https://www.example.com/page2,keyword4 keyword5
https://www.example.com/page3,
```

- **url** (required): Full URL starting with http:// or https://
- **primary_keywords** (optional): Space, comma, or semicolon-separated keywords
- Maximum 20 rows (first 20 will be processed if more are provided)

## Troubleshooting

**Extension won't open?**
- Click the extension icon in the toolbar (not the popup)
- Check that all files are in the same folder
- Reload the extension in `chrome://extensions/`

**Icons missing?**
- Extension will work without icons, but Chrome will show a default icon
- Use `create-icons.html` to generate them

**API errors?**
- Verify your API key is correct
- Check you have API quota remaining
- Try changing the model in `app.js` (line 50) to `gemini-1.5-flash`

**CSV not uploading?**
- Ensure file extension is `.csv`
- Check the CSV has a `url` column
- Verify URLs are valid (start with http:// or https://)

**Processing stuck?**
- Check browser console (F12) for errors
- Some URLs may fail due to CORS or authentication
- Failed URLs will show an error status

## File Structure

```
WebPageSchema/
├── manifest.json          ✅ Required
├── index.html             ✅ Required (main interface)
├── styles.css             ✅ Required
├── app.js                 ✅ Required (main logic)
├── background.js          ✅ Required
├── content.js             ✅ Required
├── icons/                 ⚠️ Optional (but recommended)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
├── QUICKSTART.md
└── create-icons.html      (helper tool)
```

## Features

- ✅ Batch process up to 20 URLs
- ✅ Real-time progress tracking
- ✅ Individual copy/download for each result
- ✅ Bulk download all results
- ✅ Error handling per URL
- ✅ Keyword support from CSV
- ✅ Beautiful glassmorphism UI

## Next Steps

- Customize colors in `styles.css`
- Adjust AI prompts in `app.js` (buildPrompt function)
- Change URL limit in `app.js` (MAX_URLS constant)
- Add more features as needed

Enjoy your new Chrome extension! 🚀
