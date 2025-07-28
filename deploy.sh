#!/bin/bash

# Splitwiser Deployment Script
# Updates file hashes in index.html, version in manifest.json, and commits/pushes changes
# Usage: ./deploy.sh [major|minor|patch]
# Default: patch

set -e

# Parse version type argument (default to patch)
VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(major|minor|patch)$ ]]; then
    echo "❌ Error: Invalid version type. Use 'major', 'minor', or 'patch'"
    echo "Usage: ./deploy.sh [major|minor|patch]"
    exit 1
fi

echo "🚀 Starting Splitwiser deployment (${VERSION_TYPE} version bump)..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if required files exist
if [ ! -f "index.html" ] || [ ! -f "styles.css" ] || [ ! -f "locale.js" ] || [ ! -f "lib.js" ] || [ ! -f "ui.js" ] || [ ! -f "manifest.json" ]; then
    echo "❌ Error: Required files (index.html, styles.css, locale.js, lib.js, ui.js, manifest.json) not found"
    exit 1
fi

# Function to increment version based on semver
increment_version() {
    local version=$1
    local type=$2

    # Extract major, minor, patch from version string
    local major=$(echo $version | cut -d. -f1)
    local minor=$(echo $version | cut -d. -f2)
    local patch=$(echo $version | cut -d. -f3)

    case $type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

# Get current version from manifest.json
echo "📋 Reading current version from manifest.json..."
CURRENT_VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')

if [ -z "$CURRENT_VERSION" ]; then
    echo "❌ Error: Could not read version from manifest.json"
    exit 1
fi

echo "   Current version: $CURRENT_VERSION"

# Calculate new version
NEW_VERSION=$(increment_version $CURRENT_VERSION $VERSION_TYPE)
echo "   New version: $NEW_VERSION"

# Update version in manifest.json
echo "🔄 Updating manifest.json with new version..."
sed -i.bak "s/\"version\": *\"[^\"]*\"/\"version\": \"$NEW_VERSION\"/g" manifest.json
rm -f manifest.json.bak

# Generate file hashes
echo "📝 Generating file hashes..."
CSS_HASH=$(shasum -a 256 styles.css | cut -d' ' -f1 | cut -c1-8)
LOCALE_HASH=$(shasum -a 256 locale.js | cut -d' ' -f1 | cut -c1-8)
LIB_HASH=$(shasum -a 256 lib.js | cut -d' ' -f1 | cut -c1-8)
UI_HASH=$(shasum -a 256 ui.js | cut -d' ' -f1 | cut -c1-8)

echo "   CSS hash:    $CSS_HASH"
echo "   Locale hash: $LOCALE_HASH"
echo "   Lib hash:    $LIB_HASH"
echo "   UI hash:     $UI_HASH"

# Update index.html with new hashes
echo "🔄 Updating index.html with new hashes..."
sed -i.bak "s/styles\.css?v=[^\"]*\"/styles.css?v=$CSS_HASH\"/g" index.html
sed -i.bak "s/locale\.js?v=[^\"]*\"/locale.js?v=$LOCALE_HASH\"/g" index.html
sed -i.bak "s/lib\.js?v=[^\"]*\"/lib.js?v=$LIB_HASH\"/g" index.html
sed -i.bak "s/ui\.js?v=[^\"]*\"/ui.js?v=$UI_HASH\"/g" index.html

# Remove backup file
rm -f index.html.bak

# Check if there are any changes to commit
if git diff --quiet; then
    echo "ℹ️  No changes to commit"
    exit 0
fi

# Add files to git
echo "📦 Adding files to git..."
git add index.html styles.css locale.js lib.js ui.js manifest.json

# Create commit message
COMMIT_MSG="Release v${NEW_VERSION}

- Version bump: ${CURRENT_VERSION} → ${NEW_VERSION} (${VERSION_TYPE})
- Update file hashes for deployment
  - CSS: $CSS_HASH
  - JS:  $JS_HASH
"

# Commit changes
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG"

# Push to origin
echo "🌐 Pushing to origin..."
git push origin

echo "✅ Deployment complete!"
echo "   Version: ${CURRENT_VERSION} → ${NEW_VERSION} (${VERSION_TYPE})"
echo "   Files updated with new hashes and pushed to origin"
