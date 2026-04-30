# Kosher Stories Plugin

Professional WordPress stories plugin with a visual builder, frontend story playback, story groups, scheduling, analytics, templates, stickers, background media, and poll integration.

Created by Moshe Ben-David.

Disclaimer: Access to this repository does not grant authorization to use this plugin, copy its code, or create work inspired by its code.

## Overview

Kosher Stories adds a custom `stories` post type for building mobile-first, 9:16 story experiences in WordPress. Stories are grouped by the `story_category` taxonomy and rendered on the frontend through the `[kosher_stories]` shortcode.

The plugin stores story layouts as JSON in `_kosher_story_data`, then renders those layouts on the frontend with a fullscreen story viewer. It was built as an extension-based system, so older story JSON is normalized and repaired where possible while newer features are stored as additional fields.

## Main Features

### Visual Story Builder

The admin builder includes:

- 9:16 canvas preview designed to match the frontend story frame
- Drag-and-drop layer positioning
- Resizable stickers and shapes
- Text layers with rich HTML editing through the WordPress editor
- CTA button layers with destination URLs
- Poll layers connected to the site `polls` post type
- Sticker picker powered by WordPress media attachments
- Shapes and lines: square, circle, triangle, and line
- Background image selection through the WordPress media library
- Background video selection through the WordPress media library
- Canvas background color with transparent/no-fill support
- Slide duration control from 1 to 15 seconds
- Featured image support as a story cover/background layer
- Frontend-style preview controls, progress bar, and navigation indicators

### Builder Controls

The builder also includes production workflow tools:

- Layer list with selection, visibility toggle, delete, and drag reorder
- Automatic z-index normalization based on layer order
- Grid overlay toggle
- Snap-to-grid positioning and resizing
- Smart alignment guides against canvas center and other layers
- Spacing indicator while dragging
- Undo and redo history with keyboard shortcuts
- Copy and paste selected layers through local browser storage
- Template save, load, merge, preview, and delete
- Template thumbnails from the story background image or featured image
- Transparent fill toggles for supported color fields

### Layer Types

#### Text

- Rich HTML content
- Bold, italic, underline, alignment, lists, and links through the editor
- Font family selection
- Font size
- Text color
- Transparent or solid background fill
- Padding
- Line height
- Visibility and layer ordering

#### CTA Button

- Button label
- Destination URL
- Font family
- Font size
- Text color
- Transparent or solid background fill
- Border color
- Border thickness
- Preset padding sizes: `xs`, `sm`, `md`, `lg`, `xl`
- Frontend links open in a new tab with safe `noopener noreferrer` behavior

#### Poll

- Published poll selector
- Live builder preview based on poll payload
- Adjustable poll size
- Frontend voting inside the story
- Vote submission through the existing poll AJAX handler
- Voted/result state updates after voting
- View-votes toggle when poll markup supports it
- Manual slide behavior so viewers have time to vote

#### Sticker

- Sticker picker loaded from media attachments whose title contains `_kosher-stickers__`
- Sticker scaling
- Drag positioning
- Resize handles
- Layer visibility and ordering

#### Shape And Line

- Square, circle, triangle, and line layers
- Width and height controls
- Transparent or solid fill
- Outline color and thickness
- Line color and thickness
- Resize handles for shapes and lines

### Frontend Story Viewer

The frontend viewer includes:

- Shortcode-rendered story thumbnail bar
- Story thumbnails grouped by `story_category`
- Fullscreen story playback
- AJAX loading of story groups
- Cross-category navigation after a group completes
- Previous and next navigation zones
- Swipe navigation on touch devices
- Tap/click pause and resume on non-poll slides
- Progress bars for timed slides
- Clickable progress bars for jumping between slides
- Escape key to close the viewer
- Safe media shutdown when the viewer closes
- Automatic video reset between slides
- Background video playback inside rendered story layouts
- Normal video slide duration based on actual video metadata
- Fallback slide duration when video metadata is unavailable
- Poll slides hide progress bars and disable automatic advancement

### Seen And Unseen State

The frontend tracks local viewing state in the browser:

- Per-category seen/unseen state stored in `localStorage`
- Per-story seen tracking inside each category
- Viewer starts at the first unseen story when available
- Category is marked seen after all stories in that group are viewed
- Thumbnail state refreshes while the viewer is closed
- Thumbnails update from the first unseen story when available
- Default thumbnail fallback from `assets/kosher-icon.png`

### Analytics Dashboard

Analytics are available in the WordPress admin under:

- `Stories > Analytics`

The dashboard includes:

- Total views
- Unique viewers
- Stories viewed
- Categories viewed
- Average watch time
- Total watch time
- Completion rate
- Element clicks
- Tap heatmap points
- Views over time chart
- Category views chart
- Top stories chart
- Drop-off hotspots chart
- Story performance table
- Recent views table
- Category performance table
- Drop-off tracking table
- Element click tracking table

Analytics filters include:

- Today
- Last 7 days
- Last 30 days
- This year
- Custom date range

Timeline grouping automatically switches between hourly, daily, and monthly views depending on the selected range.

### Event Tracking

The frontend records:

- Story view events
- Completed story group events
- Drop-off events before a group is finished
- Click events on story elements
- Tap/click coordinates for heatmap data
- Slide index and total slide count
- Session IDs stored in `sessionStorage`
- User ID when available
- IP-based anonymous viewer fallback

Analytics writes are batched on the frontend and flushed with `sendBeacon` on page unload when available.

### Story Lifecycle

Each story supports:

- Start date and time
- Auto-expiration amount
- Auto-expiration unit: hours or days
- Evergreen mode
- Calculated expiration display in the editor

Stories scheduled for the future or past their expiration time are hidden from frontend thumbnails, story ID lookups, and story playback unless they are marked evergreen.

### Poll Stories

Polls are integrated from the existing site `polls` post type.

Poll story behavior:

- Polls can be added as story layers in the builder
- Poll cards reuse the site poll system when available
- The builder lists published polls and shows poll status
- Users can vote directly inside the story
- If a user already voted, the voted/result state is shown
- Poll UI can update totals, percentages, selected state, voter avatars, and voter lists when supported by the poll payload
- Poll slides do not auto-advance
- Poll slides do not animate or show progress bars
- Background videos are muted when a poll is present
- Poll slides can still be skipped with arrows or swipe navigation
- If the poll system markup is unavailable, the plugin falls back to a lightweight placeholder poll card

## Frontend Integration

### Shortcode

Use this shortcode to render the stories bar:

```shortcode
[kosher_stories]
```

### Taxonomy Grouping

Stories are grouped using:

- `story_category`

The frontend progresses through stories in category order and can continue into the next category group.

## Data Storage

### Story JSON

Story layouts are stored in:

- `_kosher_story_data`

Top-level structure:

- `settings`
- `elements`

Supported settings:

- `duration`
- `backgroundColor`
- `image`
- `video`
- `audio`
- `muteVideo`
- `disableAudio`
- `disableVideo`
- `disableImage`

Supported element types:

- `text`
- `button`
- `sticker`
- `shape`
- `poll`

The JSON format is normalized on save for safety and backward compatibility.

### Templates

Templates are stored in:

- WordPress option: `kayco_story_templates`

Each template stores:

- `id`
- `name`
- `thumbnail`
- `json`
- `created_at`

The template store is capped at 100 saved templates.

### Analytics Tables

The plugin creates and maintains:

- `wp_story_views`
- `wp_story_events`

`story_views` stores:

- Story ID
- Category term ID
- User ID when available
- IP address
- Viewed timestamp
- Duration

`story_events` stores:

- `view`
- `complete`
- `dropoff`
- `click`
- `heatmap`

Event rows also include session ID, story ID, category ID, slide index, total slides, element ID/type, tap coordinates, duration, user ID, IP address, and timestamp.

### Story Lifecycle Meta

These story meta keys are used:

- `_kayco_story_start_at`
- `_kayco_story_expiration_amount`
- `_kayco_story_expiration_unit`
- `_kayco_story_expires_at`
- `_kayco_story_evergreen`

### Browser Storage

The frontend uses browser storage for:

- `kosher_story_seen` in `localStorage` for seen/unseen story state
- `kayco_story_session_id` in `sessionStorage` for analytics sessions
- `kayco_story_builder_clipboard` in `localStorage` for builder copy/paste

## Developer Notes

### Prefixing

Newer PHP helper functions use the `kayco_` prefix.

Older plugin functions still use `kosher_` because the plugin was extended rather than rewritten.

### AJAX Endpoints

The plugin uses AJAX handlers for:

- Loading category stories
- Loading story IDs for seen/unseen refresh
- Loading story thumbnails
- Loading stickers
- Loading published polls for the builder
- Loading, saving, and deleting story templates
- Tracking story views
- Tracking story events

### Poll Dependency

The plugin integrates with the theme poll system when these functions exist:

- `kayco_get_poll_public_payload()`
- `kayco_get_poll_markup()`

Voting uses the existing poll AJAX action when the poll system is available:

- `kayco_submit_poll_vote`

If the theme poll helpers are not available, the plugin falls back to a lightweight placeholder poll card so stories do not break.

### JavaScript Files

- `assets/builder.js`  
  Admin visual builder logic, media selection, templates, layer controls, polls, history, keyboard shortcuts, and canvas assists

- `assets/stories.js`  
  Frontend story playback, category loading, seen state, thumbnail refresh, interaction tracking, analytics batching, and poll voting integration

- `assets/analytics.js`  
  Admin analytics charts and filter enhancements

### CSS Files

- `assets/builder.css`
- `assets/stories.css`
- `assets/analytics.css`

### Debug Modes

Debug flags:

- `localStorage.setItem('kayco_stories_debug', '1')`
- `localStorage.setItem('kayco_story_builder_debug', '1')`

Set either value to `1` in the browser console to enable logs for that area.

## Typical Workflow

1. Create a story in the `Stories` post type.
2. Assign a `story_category`.
3. Build the layout with the visual builder.
4. Optionally set a featured image, background image, or background video.
5. Add text, buttons, stickers, shapes, or polls.
6. Optionally save the layout as a reusable template.
7. Optionally configure scheduling, expiration, or evergreen behavior.
8. Publish the story.
9. Add `[kosher_stories]` to a page or template.
10. Review engagement in `Stories > Analytics`.

## Maintenance Notes

- Story JSON is normalized before save to prevent malformed output.
- Legacy broken JSON containing unescaped quotes in `content` is repaired when possible.
- Hidden layers remain stored in JSON but are skipped during frontend rendering.
- Poll slides intentionally disable timed auto-progression.
- Analytics writes are batched on the frontend to reduce write pressure.
- Analytics tables are created on plugin activation and checked during admin initialization.
- Story visibility queries consistently apply lifecycle rules.

## Plugin Root Files

- `kosher-stories.php`
- `assets/builder.js`
- `assets/stories.js`
- `assets/analytics.js`
- `assets/builder.css`
- `assets/stories.css`
- `assets/analytics.css`
- `assets/kosher-icon.png`
