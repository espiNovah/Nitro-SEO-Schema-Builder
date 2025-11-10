# Fix: Extension Opening in Every Tab

## Problem
The extension was opening in every new tab.

## Solution Applied
1. ✅ Removed content script injection from manifest
2. ✅ Fixed manifest JSON syntax
3. ✅ Verified background script only opens tabs on icon click

## How to Fix

1. **Reload the Extension**
   - Go to `chrome://extensions/`
   - Find "Webpage Schema Builder"
   - Click the reload icon (circular arrow) 🔄
   - OR disable and re-enable the extension

2. **Clear Browser Cache (if needed)**
   - Close all Chrome windows
   - Reopen Chrome
   - The extension should now only open when you click the icon

3. **Verify It's Fixed**
   - Open a new tab (Ctrl+T / Cmd+T)
   - It should open a normal new tab, NOT the extension
   - Click the extension icon in the toolbar
   - THEN it should open the extension in a new tab

## What Changed

- **manifest.json**: Removed content_scripts section
- **content.js**: Made it empty (no longer injected)
- **background.js**: Only opens tab on explicit icon click

The extension will now ONLY open when you click the extension icon in the toolbar, not automatically.

