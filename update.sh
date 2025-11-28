#!/bin/bash

# Webpage Schema Builder Update Script

echo "Checking for updates..."

# Check if git is initialized
if [ -d ".git" ]; then
    echo "Git repository detected. Pulling latest changes..."
    git pull
    if [ $? -eq 0 ]; then
        echo "✅ Update successful!"
    else
        echo "❌ Update failed. Please check your git configuration."
    fi
else
    echo "Git not detected. Downloading latest zip..."
    # Define repository variables
    REPO_USER="espiNovah"
    REPO_NAME="Nitro-SEO-Schema-Builder"
    BRANCH="main" # or master, depending on the repo
    
    # Download zip
    curl -L -o update.zip "https://github.com/$REPO_USER/$REPO_NAME/archive/refs/heads/$BRANCH.zip"
    
    if [ $? -eq 0 ]; then
        echo "Extracting update..."
        unzip -o update.zip
        
        # Move files from subdirectory to current directory
        # Note: GitHub zips usually extract to REPO_NAME-BRANCH
        cp -R "$REPO_NAME-$BRANCH/"* .
        rm -rf "$REPO_NAME-$BRANCH"
        rm update.zip
        
        echo "✅ Update successful!"
    else
        echo "❌ Download failed. Please check your internet connection."
    fi
fi

echo "Please reload the extension in Chrome (chrome://extensions) to apply changes."
