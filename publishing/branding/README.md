# Hyperscape Branding Assets

Official logo files for the Hyperscape project. All binary files (EPS, PDF, PNG, JPG, AI) are tracked via Git LFS to prevent repository bloat.

## Logo Variants

### Full Wordmark Logos

**hyperscape_logo_color** (Primary Logo)
- Full "HYPERSCAPE" wordmark with gold gradient
- Use for: Marketing materials, website headers, social media
- Formats: SVG, EPS, PDF, PNG, JPG

**hyperscape_logo_black**
- Full wordmark, solid black
- Use for: Print on light backgrounds, monochrome applications
- Formats: SVG, EPS, PDF, PNG, JPG

**hyperscape_logo_white**
- Full wordmark, solid white
- Use for: Dark backgrounds, video overlays
- Formats: SVG, PDF

### Icon Logos

**hyperscape_logo_icon_color**
- "HS" monogram with gold gradient
- Use for: Favicons, app icons, social media avatars
- Formats: SVG, EPS, PDF

**hyperscape_logo_icon_black**
- "HS" monogram, solid black
- Use for: Monochrome icons, print applications
- Formats: SVG, EPS, PDF

## File Formats

### SVG (Source of Truth)
- Vector format for web and UI usage
- Scalable to any size without quality loss
- Recommended for all digital applications
- All SVG files have trailing newlines for git compatibility

### EPS (Git LFS)
- Vector format for print production
- Industry standard for professional printing
- Use for: Business cards, posters, merchandise

### PDF (Git LFS)
- Print-ready distribution format
- Preserves vector quality
- Use for: Sharing with print vendors, presentations

### PNG (Git LFS)
- Raster format with transparency
- Use for: Social media, presentations, web (when SVG not supported)

### JPG (Git LFS)
- Raster format without transparency
- Use for: Email attachments, legacy systems

### AI (Git LFS)
- Adobe Illustrator source templates
- Editable source files for designers
- Use for: Creating new variants, customization

## Usage Guidelines

### Primary Logo
Use `hyperscape_logo_color` (gold gradient wordmark) as the primary logo in most contexts:
- Website headers and footers
- Marketing materials
- Social media posts
- Presentations

### Icon Usage
Use `hyperscape_logo_icon_color` for:
- Favicons (16x16, 32x32, 64x64)
- App icons (iOS, Android)
- Social media profile pictures
- Small UI elements where full wordmark doesn't fit

### Color Variants
- **Color (gold gradient)**: Primary choice for all color applications
- **Black**: Light backgrounds, monochrome print, professional documents
- **White**: Dark backgrounds, video overlays, dark mode UI

### Minimum Size
- **Full wordmark**: Minimum width 120px for digital, 1 inch for print
- **Icon**: Minimum size 16x16px for digital, 0.25 inch for print

### Clear Space
Maintain clear space around the logo equal to the height of the "H" in the wordmark or the icon height.

### Don'ts
- ❌ Don't distort or stretch the logo
- ❌ Don't change colors (use provided variants)
- ❌ Don't add effects (shadows, outlines, glows)
- ❌ Don't rotate the logo
- ❌ Don't place on busy backgrounds that reduce legibility

## Git LFS

Binary branding files (~28MB total) are tracked via Git LFS to avoid repository bloat.

**Setup Git LFS** (required before cloning):
```bash
# macOS
brew install git-lfs

# Linux
apt install git-lfs

# Initialize Git LFS
git lfs install
```

**Verify LFS files**:
```bash
# Check LFS status
git lfs ls-files

# Pull LFS files (if not auto-downloaded)
git lfs pull
```

## File Naming Convention

All files follow the pattern: `hyperscape_logo_[variant]_[color].[ext]`

**Variants**:
- (no suffix) - Full wordmark
- `_icon` - Icon/monogram only
- `_template` - Editable source template

**Colors**:
- `_color` - Gold gradient (primary)
- `_black` - Solid black
- `_white` - Solid white

**Examples**:
- `hyperscape_logo_color.svg` - Full wordmark, gold gradient, SVG
- `hyperscape_logo_icon_black.eps` - Icon only, black, EPS
- `hyperscape_logo_white.pdf` - Full wordmark, white, PDF

## Contact

For branding questions or custom logo requests, contact the Hyperscape team.

## License

All Hyperscape branding assets are proprietary and may not be used without permission. See main repository LICENSE for code licensing.
