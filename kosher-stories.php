<?php
/**
 * Plugin Name: Kosher Stories (Builder Enabled + Shapes)
 */

if (!defined('ABSPATH')) exit;

/*
|--------------------------------------------------------------------------
| CPT + TAXONOMY
|--------------------------------------------------------------------------
*/
add_action('init', function () {

    register_post_type('stories', [
        'label' => 'Stories',
        'public' => true,
        'menu_icon' => 'dashicons-format-video',
        'supports' => ['title'],
        'show_in_rest' => true,
    ]);

    register_taxonomy('story_category', 'stories', [
        'label' => 'Story Categories',
        'public' => true,
        'hierarchical' => true,
        'show_in_rest' => true,
    ]);
});



/*
|--------------------------------------------------------------------------
| SHORTCODE (FRONTEND BAR)
|--------------------------------------------------------------------------
*/
add_shortcode('kosher_stories', function () {

    $terms = get_terms([
        'taxonomy' => 'story_category',
        'hide_empty' => true,
    ]);

    if (empty($terms) || is_wp_error($terms)) {
        return '<p>No stories found</p>';
    }

    ob_start();
    ?>

    <div class="kosher-stories-bar">
        <div class="container d-flex justify-content-between">
        <?php foreach ($terms as $term): ?>
            <?php if (!kayco_story_term_has_visible_stories((int) $term->term_id)) continue; ?>

<div class="kosher-story-thumb" data-term="<?php echo esc_attr($term->term_id); ?>">
    <div class="thumb-inner"></div>
</div>

        <?php endforeach; ?>
        </div>
    </div>

    <div id="kosher-stories-viewer" class="kosher-stories-viewer hidden">
        <div class="kosher-stories-content">
            <div class="kosher-close">×</div>
            <div class="kosher-stories-body"></div>
        </div>
    </div>

    <?php
    return ob_get_clean();
});
add_action('wp_ajax_kosher_get_category_stories', 'kosher_get_category_stories');
add_action('wp_ajax_nopriv_kosher_get_category_stories', 'kosher_get_category_stories');
/*
|--------------------------------------------------------------------------
| FRONTEND ASSETS
|--------------------------------------------------------------------------
*/
add_action('wp_enqueue_scripts', function () {

    wp_enqueue_style('kosher-stories', plugin_dir_url(__FILE__) . 'assets/stories.css');

    wp_enqueue_script('kosher-stories', plugin_dir_url(__FILE__) . 'assets/stories.js', [], null, true);

    wp_localize_script('kosher-stories', 'kosherStories', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'default_thumb_url' => kosher_get_default_thumb_url(),
        'poll_nonce' => wp_create_nonce('kayco_poll_vote'),
    ]);
});

/*
|--------------------------------------------------------------------------
| ADMIN BUILDER
|--------------------------------------------------------------------------
*/
add_action('admin_enqueue_scripts', function ($hook) {

    if ($hook !== 'post.php' && $hook !== 'post-new.php') return;

    global $post;
    if (!$post || $post->post_type !== 'stories') return;

    wp_enqueue_media(); // 🔥 ADD THIS

    wp_enqueue_style(
        'bootstrap-icons',
        'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
        [],
        '1.11.3'
    );

    wp_enqueue_script('jquery-ui-draggable');
    wp_enqueue_script('jquery-ui-resizable');
    wp_enqueue_script('jquery-ui-sortable');

    wp_enqueue_script('kosher-builder', plugin_dir_url(__FILE__) . 'assets/builder.js', ['jquery', 'jquery-ui-draggable', 'jquery-ui-resizable', 'jquery-ui-sortable'], null, true);

    wp_enqueue_style('kosher-builder', plugin_dir_url(__FILE__) . 'assets/builder.css');

    wp_localize_script('kosher-builder', 'kosherBuilder', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'featuredImage' => get_the_post_thumbnail_url($post->ID, 'full') ?: '',
        'nonce' => wp_create_nonce('kayco_story_builder'),
        'poll_nonce' => wp_create_nonce('kayco_poll_vote'),
    ]);
});

add_action('admin_menu', function () {
    add_submenu_page(
        'edit.php?post_type=stories',
        'Story Analytics',
        'Analytics',
        'edit_posts',
        'kosher-stories-analytics',
        'kosher_render_analytics_page'
    );
});

add_action('admin_enqueue_scripts', function ($hook) {
    if (strpos($hook, 'kosher-stories-analytics') === false) {
        return;
    }

    kosher_stories_ensure_analytics_table();

    wp_enqueue_style(
        'bootstrap-icons',
        'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
        [],
        '1.11.3'
    );

    wp_enqueue_style(
        'kosher-stories-analytics',
        plugin_dir_url(__FILE__) . 'assets/analytics.css',
        [],
        '1.0.0'
    );

    wp_enqueue_script(
        'chart-js',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
        [],
        '4.4.7',
        true
    );

    wp_enqueue_script(
        'kosher-stories-analytics',
        plugin_dir_url(__FILE__) . 'assets/analytics.js',
        ['chart-js'],
        '1.0.0',
        true
    );

    wp_localize_script('kosher-stories-analytics', 'kosherAnalytics', [
        'charts' => kosher_get_analytics_chart_data(),
    ]);
});

/*
|--------------------------------------------------------------------------
| META BOX
|--------------------------------------------------------------------------
*/
add_action('add_meta_boxes', function () {
    add_meta_box('kosher_story_builder', 'Story Builder', 'kosher_render_builder', 'stories');
    add_meta_box('kayco_story_lifecycle', 'Story Lifecycle', 'kayco_render_story_lifecycle_box', 'stories', 'side', 'high');
});

function kosher_render_builder($post) {
    $data = get_post_meta($post->ID, '_kosher_story_data', true);
    $featured_image = get_the_post_thumbnail_url($post->ID, 'full') ?: '';

    $normalized = kosher_normalize_story_data($data);
    if (is_array($normalized)) {
        $data = wp_json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        $data = '';
    }
    ?>

    <div id="kosher-story-app">

        <div class="kosher-sidebar">
            <div class="kosher-panel-intro">
                <span class="kosher-panel-kicker"><i class="bi bi-layers"></i> Story Builder</span>
                <h3>Add Layers</h3>
                <p>Choose what to place on the story, then drag it into position on the canvas.</p>
            </div>

            <button type="button" class="add-text"><i class="bi bi-type"></i><span>Add Text Block</span></button>
            <button type="button" class="add-button"><i class="bi bi-link-45deg"></i><span>Add CTA Button</span></button>
            <button type="button" class="add-poll"><i class="bi bi-bar-chart-line"></i><span>Add Poll</span></button>
            <button type="button" class="add-sticker"><i class="bi bi-emoji-smile"></i><span>Add Sticker</span></button>
            <div id="sticker-dropdown" class="sticker-dropdown hidden">
                <div class="sticker-list"></div>
            </div>
            <button type="button" class="add-shape"><i class="bi bi-bounding-box"></i><span>Add Shape or Line</span></button>

            <div class="kosher-builder-tools">
                <div class="kosher-tool-section">
                    <div class="kosher-tool-heading">
                        <span><i class="bi bi-grid-3x3-gap"></i> Canvas Assist</span>
                    </div>
                    <div class="kosher-tool-grid">
                        <button type="button" id="builder-grid-toggle" class="kosher-tool-toggle" aria-pressed="false">
                            <i class="bi bi-grid"></i><span>Grid</span>
                        </button>
                        <button type="button" id="builder-snap-toggle" class="kosher-tool-toggle is-active" aria-pressed="true">
                            <i class="bi bi-magnet"></i><span>Snap</span>
                        </button>
                    </div>
                </div>

                <div class="kosher-tool-section">
                    <div class="kosher-tool-heading">
                        <span><i class="bi bi-arrow-counterclockwise"></i> History</span>
                    </div>
                    <div class="kosher-tool-grid">
                        <button type="button" id="builder-undo" class="kosher-tool-button">
                            <i class="bi bi-arrow-counterclockwise"></i><span>Undo</span>
                        </button>
                        <button type="button" id="builder-redo" class="kosher-tool-button">
                            <i class="bi bi-arrow-clockwise"></i><span>Redo</span>
                        </button>
                    </div>
                </div>

                <div class="kosher-tool-section kosher-template-tools">
                    <div class="kosher-tool-heading">
                        <span><i class="bi bi-window-stack"></i> Templates</span>
                    </div>
                    <input type="text" id="template-name" placeholder="Template name">
                    <select id="template-list">
                        <option value="">Select saved template</option>
                    </select>
                    <div id="template-preview" class="kosher-template-preview">
                        <i class="bi bi-image"></i>
                        <span>No template selected</span>
                    </div>
                    <div class="kosher-tool-grid">
                        <button type="button" id="template-save" class="kosher-tool-button">
                            <i class="bi bi-save"></i><span>Save</span>
                        </button>
                        <button type="button" id="template-load" class="kosher-tool-button">
                            <i class="bi bi-box-arrow-in-down"></i><span>Load</span>
                        </button>
                    </div>
                    <div class="kosher-tool-grid">
                        <button type="button" id="template-merge" class="kosher-tool-button">
                            <i class="bi bi-intersect"></i><span>Merge</span>
                        </button>
                        <button type="button" id="template-delete" class="kosher-tool-button is-danger">
                            <i class="bi bi-trash3"></i><span>Delete</span>
                        </button>
                    </div>
                </div>

                <div class="kosher-tool-section kosher-layer-panel">
                    <div class="kosher-tool-heading">
                        <span><i class="bi bi-stack"></i> Layers</span>
                        <small>Drag to reorder</small>
                    </div>
                    <div id="builder-layer-list" class="kosher-layer-list"></div>
                </div>
            </div>


        </div>

        <div class="kosher-stage">
            <div class="kosher-panel-intro">
                <span class="kosher-panel-kicker"><i class="bi bi-phone"></i> Preview</span>
                <h3>Story Canvas</h3>
                <p>Design inside the safe story frame exactly as it should appear to viewers.</p>
            </div>

            <div class="kosher-preview-status">
                <span class="kosher-preview-chip"><i class="bi bi-eye"></i> Frontend Match</span>
                <span class="kosher-preview-chip"><i class="bi bi-aspect-ratio"></i> 9:16 Story</span>
                <?php if ($featured_image) : ?>
                    <span class="kosher-preview-chip"><i class="bi bi-image"></i> Featured Cover</span>
                <?php endif; ?>
            </div>

            <div class="kosher-preview-shell">
                <div class="kosher-preview-progress">
                    <span></span>
                </div>
                <div class="kosher-preview-close"><i class="bi bi-x-lg"></i></div>
                <div class="kosher-preview-nav kosher-preview-nav-prev"><i class="bi bi-chevron-left"></i></div>
                <div class="kosher-preview-nav kosher-preview-nav-next"><i class="bi bi-chevron-right"></i></div>
                <div id="kosher-canvas"></div>
            </div>
        </div>

        <div class="kosher-settings">
            <div class="kosher-panel-intro">
                <span class="kosher-panel-kicker"><i class="bi bi-sliders2-vertical"></i> Inspector</span>
                <h3>Selected Layer</h3>
                <p>Refine typography, colors, borders, and spacing for the item you have selected.</p>
            </div>

            <div id="settings-empty" class="settings-empty">
                <i class="bi bi-cursor"></i>
                <div>
                    <strong>Select a layer to begin</strong>
                    <p>Click any text, sticker, shape, or button on the canvas to edit its styling here.</p>
                </div>
            </div>

            <!-- TEXT SETTINGS -->
            <div id="text-settings" class="hidden">
                <label>Text Size</label>
                <input type="range" id="font-size" min="10" max="80">

                <label>Typeface</label>
                <select id="font-family">
                    <option value="Alumni Sans Pinstripe">Alumni Sans Pinstripe</option>
                    <option value="Birthstone">Birthstone</option>
                    <option value="Carter One">Carter One</option>
                    <option value="Caveat Brush">Caveat Brush</option>
                    <option value="Courgette">Courgette</option>
                    <option value="Fuzzy Bubbles">Fuzzy Bubbles</option>
                    <option value="Inter">Inter</option>
                    <option value="Meow Script">Meow Script</option>
                    <option value="Spectral">Spectral</option>
                    <option value="Walter Turncoat">Walter Turncoat</option>
                </select>

                <label>Text Color</label>
                <input type="color" id="text-color">

                <label>Text Padding</label>
                <input type="number" id="text-padding" min="0" max="200" step="1">

                <label>Line Height</label>
                <input type="number" id="text-line-height" min="0.8" max="3" step="0.1">

                <label>Text Content</label>
                <?php
                wp_editor('', 'kosher_text_editor', [
                    'textarea_name' => 'kosher_text_editor',
                    'media_buttons' => false,
                    'textarea_rows' => 12,
                    'teeny' => false,
                    'tinymce' => [
                        'toolbar1' => 'bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist | link unlink',
                    ],
                ]);
                ?>

                <label>Fill Color</label>
                <div class="kosher-color-picker-row">
                    <input type="color" id="bg-color" data-supports-transparent="true">
                    <button type="button" class="transparent-toggle" data-target="#bg-color" aria-label="No fill">
                        <span class="transparent-swatch" aria-hidden="true"></span>
                    </button>
                </div>
            </div>

            <div id="button-settings" class="hidden">
                <label>Button Text</label>
                <input type="text" id="button-label">

                <label>Destination URL</label>
                <input type="url" id="button-url" placeholder="https://example.com">

                <label>Text Size</label>
                <input type="range" id="button-font-size" min="10" max="80">

                <label>Typeface</label>
                <select id="button-font-family">
                    <option value="Alumni Sans Pinstripe">Alumni Sans Pinstripe</option>
                    <option value="Birthstone">Birthstone</option>
                    <option value="Carter One">Carter One</option>
                    <option value="Caveat Brush">Caveat Brush</option>
                    <option value="Courgette">Courgette</option>
                    <option value="Fuzzy Bubbles">Fuzzy Bubbles</option>
                    <option value="Inter">Inter</option>
                    <option value="Meow Script">Meow Script</option>
                    <option value="Spectral">Spectral</option>
                    <option value="Walter Turncoat">Walter Turncoat</option>
                </select>

                <label>Text Color</label>
                <input type="color" id="button-color">

                <label>Fill Color</label>
                <div class="kosher-color-picker-row">
                    <input type="color" id="button-background" data-supports-transparent="true">
                    <button type="button" class="transparent-toggle" data-target="#button-background" aria-label="No fill">
                        <span class="transparent-swatch" aria-hidden="true"></span>
                    </button>
                </div>

                <label>Border Color</label>
                <input type="color" id="button-border-color">

                <label>Border Thickness</label>
                <input type="number" id="button-border-width" min="0" max="20">

                <label>Padding Size</label>
                <select id="button-size">
                    <option value="xs">XS</option>
                    <option value="sm">SM</option>
                    <option value="md">MD</option>
                    <option value="lg">LG</option>
                    <option value="xl">XL</option>
                </select>
            </div>

            <div id="poll-settings" class="hidden">
                <label>Connected Poll</label>
                <select id="poll-select">
                    <option value="">Choose a poll</option>
                </select>

                <label>Poll Size</label>
                <input type="range" id="poll-width" min="55" max="100" step="1">

                <div class="kosher-poll-settings-preview" id="poll-settings-status">
                    <i class="bi bi-bar-chart-line"></i>
                    <div>
                        <strong>Poll details will appear here</strong>
                        <p>Poll slides stay manual so viewers have time to vote.</p>
                    </div>
                </div>
            </div>
            <!-- STICKERS SETTINGS -->
            <div id="sticker-settings" class="hidden">
                <label>Sticker Scale</label>
                <input type="range" id="sticker-size" min="10" max="500" step="1">

            </div>

            <!-- SHAPE SETTINGS -->
            <div id="shape-settings" class="hidden">

                <label>Shape Type</label>
                <select id="shape-type">
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                    <option value="triangle">Triangle</option>
                    <option value="line">Line</option>
                </select>

                <label>Fill Color</label>
                <div class="kosher-color-picker-row">
                    <input type="color" id="shape-bg" data-supports-transparent="true">
                    <button type="button" class="transparent-toggle" data-target="#shape-bg" aria-label="No fill">
                        <span class="transparent-swatch" aria-hidden="true"></span>
                    </button>
                </div>

                <label>Outline Color</label>
                <input type="color" id="shape-border">

                <label>Outline Thickness</label>
                <input type="number" id="shape-border-width">

                <label>Width</label>
                <input type="number" id="shape-width">

                <label>Height</label>
                <input type="number" id="shape-height">

                <div id="line-settings">
                    <label>Line Color</label>
                    <input type="color" id="line-color">

                    <label>Line Thickness</label>
                    <input type="number" id="line-thickness">
                </div>

            </div>

            <button type="button" id="delete-el"><i class="bi bi-trash3"></i><span>Remove Selected Layer</span></button>
        </div>

    </div>

    <div class='story-global-settings'>
    <div class="story-global-settings-head">
        <span class="kosher-panel-kicker"><i class="bi bi-stars"></i> Global Story Settings</span>
        <h3>Playback & Background</h3>
        <p>These controls affect the full story frame and playback experience, not just one selected layer.</p>
    </div>
    <div class='story-global-settings-card'>
        <div class="story-global-grid">
            <div class="story-global-card story-global-card--compact">
                <label><i class="bi bi-stopwatch"></i> Slide Duration</label>
                <p>Control how long each story frame stays visible before advancing.</p>
                <div class="story-duration-control">
                    <input 
                        type="range" 
                        id="story-duration" 
                        min="1000" 
                        max="15000" 
                        step="500" 
                        value="3000"
                    >

                    <div class="duration-display">
                        <span id="story-duration-value">3</span> s
                    </div>
                </div>
            </div>

            <div class="story-global-card story-global-card--compact">
                <label><i class="bi bi-palette2"></i> Canvas Background Color</label>
                <p>Use a fallback color when there is no background image or video selected.</p>
                <div class="story-color-control">
                    <div class="kosher-color-picker-row">
                        <input type="color" id="story-background-color" data-supports-transparent="true">
                        <button type="button" class="transparent-toggle" data-target="#story-background-color" aria-label="No fill">
                            <span class="transparent-swatch" aria-hidden="true"></span>
                        </button>
                    </div>
                    <span>Story canvas fill</span>
                </div>
            </div>
        </div>

        <div class="story-global-media-grid">
            <div class="story-global-card story-global-media-card">
                <div class="story-global-card-head">
                    <div>
                        <h4><i class="bi bi-film"></i> Background Video</h4>
                        <p>Use a looping video as the base layer of the story frame.</p>
                    </div>
                    <button type="button" id="select-bg-video"><i class="bi bi-film"></i><span>Choose Video</span></button>
                </div>
                <input type="hidden" id="story-background-video">
                <div class="preview-wrap-video">
                    <div id="bg-video-preview"></div>
                    <button type="button" id="remove-bg-video"><i class="bi bi-trash3"></i><span>Remove</span></button>
                </div>
                <label class="kosher-switch" for="story-background-video-muted">
                    <span class="kosher-switch-copy">
                        <strong>Mute Video Audio</strong>
                        <small>Keep the background video silent during playback.</small>
                    </span>
                    <span class="kosher-switch-control">
                        <input type="checkbox" id="story-background-video-muted">
                        <span class="kosher-switch-slider" aria-hidden="true"></span>
                    </span>
                </label>
            </div>

            <div class="story-global-card story-global-media-card">
                <div class="story-global-card-head">
                    <div>
                        <h4><i class="bi bi-image"></i> Background Image</h4>
                        <p>Choose a static image to sit behind your story layers.</p>
                    </div>
                    <button type="button" id="select-bg-image"><i class="bi bi-image"></i><span>Choose Image</span></button>
                </div>
                <input type="hidden" id="story-background-image">
                <div class="preview-wrap-image"> 
                    <div id="bg-image-preview"></div>
                    <button type="button" id="remove-bg-image"><i class="bi bi-trash3"></i><span>Remove</span></button>
                </div>
            </div>
        </div>

</div>
</div>


<textarea id="kosher_story_data" name="kosher_story_data" style="display:none;">
      <?php echo esc_textarea($data); ?>
    </textarea>

    <?php
}

function kayco_render_story_lifecycle_box($post) {
    wp_nonce_field('kayco_story_lifecycle', 'kayco_story_lifecycle_nonce');

    $start_at = get_post_meta($post->ID, '_kayco_story_start_at', true);
    $expires_at = get_post_meta($post->ID, '_kayco_story_expires_at', true);
    $expiration_amount = get_post_meta($post->ID, '_kayco_story_expiration_amount', true);
    $expiration_unit = get_post_meta($post->ID, '_kayco_story_expiration_unit', true) ?: 'days';
    $evergreen = get_post_meta($post->ID, '_kayco_story_evergreen', true) === '1';

    ?>
    <div class="kayco-lifecycle-box">
        <p>
            <label for="kayco-story-start-at"><strong>Start Date / Time</strong></label>
            <input type="datetime-local"
                   id="kayco-story-start-at"
                   name="kayco_story_start_at"
                   value="<?php echo esc_attr(kayco_mysql_to_datetime_local($start_at)); ?>"
                   style="width:100%;">
        </p>

        <p>
            <label for="kayco-story-expiration-amount"><strong>Auto Expiration</strong></label>
            <span style="display:flex; gap:8px;">
                <input type="number"
                       id="kayco-story-expiration-amount"
                       name="kayco_story_expiration_amount"
                       min="0"
                       step="1"
                       value="<?php echo esc_attr($expiration_amount); ?>"
                       placeholder="None"
                       style="width:55%;">
                <select name="kayco_story_expiration_unit" style="width:45%;">
                    <option value="hours" <?php selected($expiration_unit, 'hours'); ?>>Hours</option>
                    <option value="days" <?php selected($expiration_unit, 'days'); ?>>Days</option>
                </select>
            </span>
        </p>

        <p>
            <label>
                <input type="checkbox" name="kayco_story_evergreen" value="1" <?php checked($evergreen); ?>>
                Evergreen story
            </label>
            <span class="description" style="display:block; margin-top:4px;">Evergreen stories ignore expiration and always remain visible.</span>
        </p>

        <?php if ($expires_at && !$evergreen) : ?>
            <p class="description">Calculated expiration: <?php echo esc_html(mysql2date('M j, Y g:i A', $expires_at)); ?></p>
        <?php endif; ?>
    </div>
    <?php
}

function kayco_mysql_to_datetime_local($mysql_date) {
    if (!$mysql_date) {
        return '';
    }

    $timestamp = strtotime($mysql_date);
    return $timestamp ? date('Y-m-d\TH:i', $timestamp) : '';
}

function kayco_datetime_local_to_mysql($value) {
    if (!$value) {
        return '';
    }

    $timestamp = strtotime($value);
    return $timestamp ? date('Y-m-d H:i:s', $timestamp) : '';
}

function kayco_calculate_story_expiration($post_id, $start_at, $amount, $unit) {
    $amount = max(0, intval($amount));

    if (!$amount) {
        return '';
    }

    $base = $start_at ?: get_post_field('post_date', $post_id);
    $timestamp = strtotime($base);

    if (!$timestamp) {
        $timestamp = current_time('timestamp');
    }

    $modifier = '+' . $amount . ' ' . ($unit === 'hours' ? 'hours' : 'days');
    $expires = strtotime($modifier, $timestamp);

    return $expires ? date('Y-m-d H:i:s', $expires) : '';
}

function kayco_get_visible_story_meta_query() {
    $now = current_time('mysql');

    return [
        'relation' => 'OR',
        [
            'key' => '_kayco_story_evergreen',
            'value' => '1',
            'compare' => '=',
        ],
        [
            'relation' => 'AND',
            [
                'relation' => 'OR',
                [
                    'key' => '_kayco_story_start_at',
                    'compare' => 'NOT EXISTS',
                ],
                [
                    'key' => '_kayco_story_start_at',
                    'value' => '',
                    'compare' => '=',
                ],
                [
                    'key' => '_kayco_story_start_at',
                    'value' => $now,
                    'compare' => '<=',
                    'type' => 'DATETIME',
                ],
            ],
            [
                'relation' => 'OR',
                [
                    'key' => '_kayco_story_expires_at',
                    'compare' => 'NOT EXISTS',
                ],
                [
                    'key' => '_kayco_story_expires_at',
                    'value' => '',
                    'compare' => '=',
                ],
                [
                    'key' => '_kayco_story_expires_at',
                    'value' => $now,
                    'compare' => '>',
                    'type' => 'DATETIME',
                ],
            ],
        ],
    ];
}

function kayco_story_term_has_visible_stories($term_id) {
    $stories = get_posts([
        'post_type' => 'stories',
        'post_status' => 'publish',
        'posts_per_page' => 1,
        'fields' => 'ids',
        'meta_query' => kayco_get_visible_story_meta_query(),
        'tax_query' => [[
            'taxonomy' => 'story_category',
            'terms' => (int) $term_id,
        ]],
    ]);

    return !empty($stories);
}

function kosher_sanitize_story_color($value, $default = '#000000') {
    if (!is_string($value) || $value === '') {
        return $default;
    }

    if ($value === 'transparent') {
        return 'transparent';
    }

    $color = sanitize_hex_color($value);

    return $color ?: $default;
}

function kosher_sanitize_story_font_family($value, $default = 'Spectral') {
    if (!is_string($value)) {
        return $default;
    }

    $value = wp_strip_all_tags($value);
    $value = preg_replace('/[^a-zA-Z0-9,\-\'"\s]/', '', $value);
    $value = trim($value);

    return $value !== '' ? $value : $default;
}

function kosher_get_button_size($size) {
    $allowed = ['xs', 'sm', 'md', 'lg', 'xl'];
    $size = sanitize_key($size);

    return in_array($size, $allowed, true) ? $size : 'sm';
}

function kosher_get_default_thumb_url() {
    $extensions = ['png', 'svg', 'webp', 'jpg', 'jpeg'];

    foreach ($extensions as $extension) {
        $relative_path = 'assets/kosher-icon.' . $extension;
        $absolute_path = plugin_dir_path(__FILE__) . $relative_path;

        if (file_exists($absolute_path)) {
            return plugin_dir_url(__FILE__) . $relative_path;
        }
    }

    return '';
}

function kayco_sanitize_element_id($value, $fallback = '') {
    $value = is_string($value) ? sanitize_key($value) : '';
    return $value !== '' ? $value : $fallback;
}

function kayco_get_story_poll_payload($poll_id) {
    $poll_id = absint($poll_id);

    if (!$poll_id || get_post_type($poll_id) !== 'polls') {
        return null;
    }

    if (function_exists('kayco_get_poll_public_payload')) {
        $payload = kayco_get_poll_public_payload($poll_id);
        return is_array($payload) ? $payload : null;
    }

    return [
        'pollId' => $poll_id,
        'title' => get_the_title($poll_id),
        'description' => '',
        'totalVotes' => 0,
        'userVote' => '',
        'hasVoted' => false,
        'state' => 'active',
        'stateLabel' => 'Please select one',
        'options' => [],
    ];
}

function kayco_get_story_poll_markup($poll_id) {
    $poll_id = absint($poll_id);

    if (!$poll_id || get_post_type($poll_id) !== 'polls') {
        return '';
    }

    if (function_exists('kayco_get_poll_markup')) {
        return (string) kayco_get_poll_markup($poll_id);
    }

    $title = get_the_title($poll_id);

    return sprintf(
        '<article class="kayco-poll-card is-active" data-poll-id="%1$d" data-user-vote="" data-has-voted="false"><div class="kayco-poll-card__surface"><div class="kayco-poll-card__header"><div class="kayco-poll-card__intro"><h3 class="kayco-poll-card__title">%2$s</h3><p class="kayco-poll-card__notification">Please select one</p></div></div></div></article>',
        $poll_id,
        esc_html($title ?: 'Poll')
    );
}

function kayco_story_has_poll_element($data) {
    $data = kosher_normalize_story_data($data);

    if (!is_array($data) || empty($data['elements']) || !is_array($data['elements'])) {
        return false;
    }

    foreach ($data['elements'] as $element) {
        if (!is_array($element) || (($element['visible'] ?? true) === false)) {
            continue;
        }

        if (($element['type'] ?? '') === 'poll' && !empty($element['pollId'])) {
            return true;
        }
    }

    return false;
}

function kosher_repair_story_json($raw_data) {
    if (!is_string($raw_data) || $raw_data === '') {
        return null;
    }

    $repaired = preg_replace_callback(
        '/("content"\s*:\s*")([\s\S]*?)("\s*,\s*"x"\s*:)/',
        function ($matches) {
            $content = preg_replace('/(?<!\\\\)"/', '\\"', $matches[2]);
            return $matches[1] . $content . $matches[3];
        },
        $raw_data
    );

    return is_string($repaired) ? $repaired : null;
}

function kosher_decode_story_data($raw_data) {
    if (is_array($raw_data)) {
        return $raw_data;
    }

    if (!is_string($raw_data) || trim($raw_data) === '') {
        return null;
    }

    $decoded = json_decode($raw_data, true);
    if (is_array($decoded)) {
        return $decoded;
    }

    $repaired = kosher_repair_story_json($raw_data);
    if (!is_string($repaired) || $repaired === $raw_data) {
        return null;
    }

    $decoded = json_decode($repaired, true);

    return is_array($decoded) ? $decoded : null;
}

function kosher_normalize_story_data($raw_data) {
    $decoded = kosher_decode_story_data($raw_data);
    if (!is_array($decoded)) {
        return null;
    }

    $normalized = [
        'elements' => [],
        'settings' => [],
    ];

    $settings = isset($decoded['settings']) && is_array($decoded['settings'])
        ? $decoded['settings']
        : [];

    $normalized['settings'] = [
        'duration' => max(1000, min(15000, intval($settings['duration'] ?? 3000))),
        'backgroundColor' => kosher_sanitize_story_color($settings['backgroundColor'] ?? '#000000', '#000000'),
        'image' => esc_url_raw($settings['image'] ?? ''),
        'video' => esc_url_raw($settings['video'] ?? ''),
        'audio' => esc_url_raw($settings['audio'] ?? ''),
        'muteVideo' => !empty($settings['muteVideo']),
        'disableAudio' => !empty($settings['disableAudio']),
        'disableVideo' => !empty($settings['disableVideo']),
        'disableImage' => !empty($settings['disableImage']),
    ];

    $elements = isset($decoded['elements']) && is_array($decoded['elements'])
        ? $decoded['elements']
        : [];

    foreach ($elements as $el) {
        if (!is_array($el)) {
            continue;
        }

        $type = sanitize_key($el['type'] ?? '');
        $element_index = count($normalized['elements']);
        $element_id = kayco_sanitize_element_id($el['id'] ?? '', 'el_' . $element_index);

        if ($type === 'text') {
            $normalized['elements'][] = [
                'id' => $element_id,
                'type' => 'text',
                'content' => wp_kses_post($el['content'] ?? ''),
                'x' => max(0, min(100, floatval($el['x'] ?? 50))),
                'y' => max(0, min(100, floatval($el['y'] ?? 50))),
                'size' => max(10, min(200, intval($el['size'] ?? 24))),
                'color' => kosher_sanitize_story_color($el['color'] ?? '#ffffff', '#ffffff'),
                'bg' => kosher_sanitize_story_color($el['bg'] ?? 'transparent', 'transparent'),
                'padding' => max(0, min(200, intval($el['padding'] ?? 0))),
                'lineHeight' => max(0.8, min(3, floatval($el['lineHeight'] ?? 1.2))),
                'fontFamily' => kosher_sanitize_story_font_family($el['fontFamily'] ?? 'Spectral', 'Spectral'),
                'z' => max(1, intval($el['z'] ?? 1)),
                'visible' => !isset($el['visible']) || $el['visible'] !== false,
                'align' => sanitize_key($el['align'] ?? 'left'),
            ];

            continue;
        }

        if ($type === 'button') {
            $normalized['elements'][] = [
                'id' => $element_id,
                'type' => 'button',
                'label' => sanitize_text_field($el['label'] ?? 'Button'),
                'url' => esc_url_raw($el['url'] ?? ''),
                'x' => max(0, min(100, floatval($el['x'] ?? 50))),
                'y' => max(0, min(100, floatval($el['y'] ?? 50))),
                'size' => max(10, min(200, intval($el['size'] ?? 18))),
                'fontFamily' => kosher_sanitize_story_font_family($el['fontFamily'] ?? 'Arial', 'Arial'),
                'color' => kosher_sanitize_story_color($el['color'] ?? '#ffffff', '#ffffff'),
                'bg' => kosher_sanitize_story_color($el['bg'] ?? '#000000', '#000000'),
                'borderColor' => kosher_sanitize_story_color($el['borderColor'] ?? '#000000', '#000000'),
                'borderWidth' => max(0, intval($el['borderWidth'] ?? 1)),
                'buttonSize' => kosher_get_button_size($el['buttonSize'] ?? 'sm'),
                'z' => max(1, intval($el['z'] ?? 1)),
                'visible' => !isset($el['visible']) || $el['visible'] !== false,
            ];

            continue;
        }

        if ($type === 'sticker') {
            $normalized['elements'][] = [
                'id' => $element_id,
                'type' => 'sticker',
                'src' => esc_url_raw($el['src'] ?? ''),
                'x' => max(0, min(100, floatval($el['x'] ?? 50))),
                'y' => max(0, min(100, floatval($el['y'] ?? 50))),
                'width' => max(1, intval($el['width'] ?? 120)),
                'height' => max(1, intval($el['height'] ?? 120)),
                'z' => max(1, intval($el['z'] ?? 1)),
                'visible' => !isset($el['visible']) || $el['visible'] !== false,
            ];

            continue;
        }

        if ($type === 'shape') {
            $normalized['elements'][] = [
                'id' => $element_id,
                'type' => 'shape',
                'shape' => sanitize_key($el['shape'] ?? 'square'),
                'x' => max(0, min(100, floatval($el['x'] ?? 50))),
                'y' => max(0, min(100, floatval($el['y'] ?? 50))),
                'width' => max(1, intval($el['width'] ?? 100)),
                'height' => max(1, intval($el['height'] ?? 100)),
                'bg' => kosher_sanitize_story_color($el['bg'] ?? '#ff0000', '#ff0000'),
                'borderColor' => kosher_sanitize_story_color($el['borderColor'] ?? '#000000', '#000000'),
                'borderWidth' => max(0, intval($el['borderWidth'] ?? 0)),
                'lineColor' => kosher_sanitize_story_color($el['lineColor'] ?? '#000000', '#000000'),
                'lineThickness' => max(1, intval($el['lineThickness'] ?? 3)),
                'z' => max(1, intval($el['z'] ?? 1)),
                'visible' => !isset($el['visible']) || $el['visible'] !== false,
            ];

            continue;
        }

        if ($type === 'poll') {
            $normalized['elements'][] = [
                'id' => $element_id,
                'type' => 'poll',
                'pollId' => absint($el['pollId'] ?? 0),
                'x' => max(0, min(100, floatval($el['x'] ?? 8))),
                'y' => max(0, min(100, floatval($el['y'] ?? 16))),
                'size' => max(55, min(100, intval($el['size'] ?? ($el['width'] ?? 100)))),
                'width' => max(55, min(100, intval($el['width'] ?? ($el['size'] ?? 100)))),
                'z' => max(1, intval($el['z'] ?? 1)),
                'visible' => !isset($el['visible']) || $el['visible'] !== false,
            ];
        }
    }

    return $normalized;
}

/*
|--------------------------------------------------------------------------
| SAVE
|--------------------------------------------------------------------------
*/
add_action('save_post', function ($post_id) {

    // 🚫 Prevent autosave
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    // 🚫 Prevent revisions
    if (wp_is_post_revision($post_id)) {
        return;
    }

    // 🚫 Optional: check post type
    if (get_post_type($post_id) !== 'stories') {
        return;
    }

    if (isset($_POST['kosher_story_data'])) {

        // ✅ Remove WP slashes
        $data = wp_unslash($_POST['kosher_story_data']);

        $normalized = kosher_normalize_story_data($data);
        if (!is_array($normalized)) {
            error_log('❌ Invalid JSON in kosher_story_data');
            return;
        }

        $json = wp_json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if ($json === false) {
            error_log('❌ Failed to encode kosher_story_data');
            return;
        }

        update_post_meta($post_id, '_kosher_story_data', $json);
    }

    if (isset($_POST['kayco_story_lifecycle_nonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['kayco_story_lifecycle_nonce'])), 'kayco_story_lifecycle')) {
        $start_at = kayco_datetime_local_to_mysql(sanitize_text_field(wp_unslash($_POST['kayco_story_start_at'] ?? '')));
        $expiration_amount = max(0, intval($_POST['kayco_story_expiration_amount'] ?? 0));
        $expiration_unit = sanitize_key($_POST['kayco_story_expiration_unit'] ?? 'days');
        $expiration_unit = $expiration_unit === 'hours' ? 'hours' : 'days';
        $evergreen = !empty($_POST['kayco_story_evergreen']) ? '1' : '0';
        $expires_at = $evergreen === '1' ? '' : kayco_calculate_story_expiration($post_id, $start_at, $expiration_amount, $expiration_unit);

        update_post_meta($post_id, '_kayco_story_start_at', $start_at);
        update_post_meta($post_id, '_kayco_story_expiration_amount', $expiration_amount ?: '');
        update_post_meta($post_id, '_kayco_story_expiration_unit', $expiration_unit);
        update_post_meta($post_id, '_kayco_story_expires_at', $expires_at);
        update_post_meta($post_id, '_kayco_story_evergreen', $evergreen);
    }
});

/*
|--------------------------------------------------------------------------
| AJAX STICKERS
|--------------------------------------------------------------------------
*/
add_action('wp_ajax_kosher_get_stickers', function () {

    // SECURITY (optional but recommended)
    if (!current_user_can('edit_posts')) {
        wp_send_json_error(['message' => 'Unauthorized'], 403);
    }

    // QUERY ONLY WHAT WE NEED (FASTER)
    $attachments = get_posts([
        'post_type'      => 'attachment',
        'post_status'    => 'inherit',
        'posts_per_page' => -1,
        'fields'         => 'ids', // 🔥 HUGE performance gain
    ]);

    if (empty($attachments)) {
        wp_send_json_success([]);
    }

    $stickers = [];

    foreach ($attachments as $attachment_id) {

        $title = get_the_title($attachment_id);

        // FILTER STICKERS
        if (stripos($title, '_kosher-stickers__') === false) {
            continue;
        }

        $url = wp_get_attachment_image_url($attachment_id, 'full');

        if (!$url) continue;

        $stickers[] = [
            'id'  => $attachment_id,
            'url' => esc_url($url),
        ];
    }

    // OPTIONAL: SORT (by title)
    usort($stickers, function ($a, $b) {
        return strcmp($a['url'], $b['url']);
    });

    wp_send_json_success($stickers);
});

add_action('wp_ajax_kayco_get_story_templates', 'kayco_get_story_templates');
add_action('wp_ajax_kayco_save_story_template', 'kayco_save_story_template');
add_action('wp_ajax_kayco_delete_story_template', 'kayco_delete_story_template');
add_action('wp_ajax_kayco_get_story_polls', 'kayco_get_story_polls');

function kayco_verify_story_builder_ajax() {
    if (!current_user_can('edit_posts')) {
        wp_send_json_error(['message' => 'Unauthorized'], 403);
    }

    check_ajax_referer('kayco_story_builder', 'nonce');
}

function kayco_get_story_templates_option() {
    $templates = get_option('kayco_story_templates', []);
    return is_array($templates) ? $templates : [];
}

function kayco_prepare_story_template_for_response($template) {
    return [
        'id' => sanitize_key($template['id'] ?? ''),
        'name' => sanitize_text_field($template['name'] ?? ''),
        'thumbnail' => esc_url_raw($template['thumbnail'] ?? ''),
        'json' => is_string($template['json'] ?? '') ? $template['json'] : '',
        'created_at' => sanitize_text_field($template['created_at'] ?? ''),
    ];
}

function kayco_get_story_templates() {
    kayco_verify_story_builder_ajax();

    $templates = array_values(array_map('kayco_prepare_story_template_for_response', kayco_get_story_templates_option()));

    wp_send_json_success(['templates' => $templates]);
}

function kayco_save_story_template() {
    kayco_verify_story_builder_ajax();

    $name = sanitize_text_field(wp_unslash($_POST['name'] ?? ''));
    $raw_json = wp_unslash($_POST['json'] ?? '');
    $thumbnail = esc_url_raw(wp_unslash($_POST['thumbnail'] ?? ''));
    $normalized = kosher_normalize_story_data($raw_json);

    if ($name === '' || !is_array($normalized)) {
        wp_send_json_error(['message' => 'Invalid template data'], 400);
    }

    $json = wp_json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        wp_send_json_error(['message' => 'Template JSON could not be encoded'], 400);
    }

    $templates = kayco_get_story_templates_option();
    $template_id = 'tpl_' . wp_generate_uuid4();
    $templates[$template_id] = [
        'id' => $template_id,
        'name' => $name,
        'thumbnail' => $thumbnail,
        'json' => $json,
        'created_at' => current_time('mysql'),
    ];

    if (count($templates) > 100) {
        uasort($templates, function ($a, $b) {
            return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
        });
        $templates = array_slice($templates, 0, 100, true);
    }

    update_option('kayco_story_templates', $templates, false);

    wp_send_json_success(['template' => kayco_prepare_story_template_for_response($templates[$template_id])]);
}

function kayco_delete_story_template() {
    kayco_verify_story_builder_ajax();

    $template_id = sanitize_key(wp_unslash($_POST['template_id'] ?? ''));
    $templates = kayco_get_story_templates_option();

    if (!$template_id || !isset($templates[$template_id])) {
        wp_send_json_error(['message' => 'Template not found'], 404);
    }

    unset($templates[$template_id]);
    update_option('kayco_story_templates', $templates, false);

    wp_send_json_success();
}

function kayco_get_story_polls() {
    kayco_verify_story_builder_ajax();

    $poll_ids = get_posts([
        'post_type' => 'polls',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'orderby' => 'date',
        'order' => 'DESC',
        'fields' => 'ids',
        'ignore_sticky_posts' => true,
        'update_post_meta_cache' => false,
        'update_post_term_cache' => false,
    ]);

    $polls = [];

    foreach ($poll_ids as $poll_id) {
        $payload = kayco_get_story_poll_payload($poll_id);

        if (!is_array($payload)) {
            continue;
        }

        $polls[] = [
            'id' => (int) $poll_id,
            'title' => get_the_title($poll_id) ?: 'Untitled Poll',
            'payload' => $payload,
        ];
    }

    wp_send_json_success(['polls' => $polls]);
}

/*
|--------------------------------------------------------------------------
| RENDER STORY
|--------------------------------------------------------------------------
*/
function kosher_render_story($data, $post_id = null) {

    if (empty($data)) return '';

    $data = kosher_normalize_story_data($data);
    if (!is_array($data)) return '';
    if (empty($data['elements']) || !is_array($data['elements'])) return '';


    // =========================
    // GLOBAL SETTINGS
    // =========================
    $settings = $data['settings'] ?? [];

    $video = esc_url($settings['video'] ?? '');
    $image = esc_url($settings['image'] ?? '');
    $audio = esc_url($settings['audio'] ?? '');
    $bgColor = kosher_sanitize_story_color($settings['backgroundColor'] ?? '#000000', '#000000');

    $muteVideo = !empty($settings['muteVideo']);
    $disableAudio = !empty($settings['disableAudio']);
    $disableVideo = !empty($settings['disableVideo']);
    $disableImage = !empty($settings['disableImage']);
    $duration = max(1000, min(15000, intval($settings['duration'] ?? 3000)));


    // =========================
    // FEATURED IMAGE
    // =========================
    $bg_html = '';


    if (!$post_id) {
        global $post;
        $post_id = $post->ID ?? 0;
    }

    if ($post_id && has_post_thumbnail($post_id)) {

        $img = get_the_post_thumbnail_url($post_id, 'full');

        if ($img) {
            $img = esc_url($img);

            $bg_html = "
                <div class='story-background--image'>
                    <figure>
                        <img src='{$img}' alt=''>
                    </figure>
                </div>
            ";
        }
    }

    // =========================
    // CANVAS
    // =========================

    if (!empty($video)) {

    $html = "
    <div class='kosher-story-canvas'>
        <video class='story-bg-video' paused muted playsinline>
            <source src='{$video}' type='video/mp4'>
        </video>
    ";

} elseif (!empty($image)) {

    $html = "<div class='kosher-story-canvas' style=\"background-image:url('{$image}'); background-size:cover; background-position:center;\">";

} else {

        $html = "<div class='kosher-story-canvas' style='background: {$bgColor};'>";    
}

    // BACKGROUND FIRST (lowest layer)
    $html .= $bg_html;

    foreach ($data['elements'] as $el) {
        if (isset($el['visible']) && $el['visible'] === false) {
            continue;
        }

        $type = $el['type'] ?? '';

        $x = $el['x'] ?? 50;
        $y = $el['y'] ?? 50;
        $z = $el['z'] ?? 1;
        $element_id = esc_attr($el['id'] ?? '');

        // =========================
        // TEXT
        // =========================
        if ($type === 'text') {
            
            $fontFamily = kosher_sanitize_story_font_family($el['fontFamily'] ?? 'Spectral', 'Spectral');
            $size  = max(10, min(200, intval($el['size'] ?? 24)));
            $color = kosher_sanitize_story_color($el['color'] ?? '#ffffff', '#ffffff');
            $bg    = kosher_sanitize_story_color($el['bg'] ?? 'transparent', 'transparent');

            $content = wp_kses_post($el['content'] ?? '');

            $html .= "
                <div class='story-el story-text'
                     data-element-id='{$element_id}'
                     data-element-type='text'
                     style='
                        position:absolute;
                        top: {$y}%;
                        left: {$x}%;
                        font-family: {$fontFamily} !important;
                        font-size: {$size}px!important;
                        color: {$color};
                        background: {$bg};
                        padding: " . max(0, min(200, intval($el['padding'] ?? 0))) . "px;
                        line-height: " . max(0.8, min(3, floatval($el['lineHeight'] ?? 1.2))) . ";
                        z-index: {$z};
                     '>
                    {$content}
                </div>
            ";
        }

        // =========================
        // STICKER
        // =========================
        if ($type === 'sticker') {

            $src   = esc_url($el['src'] ?? '');
            $width = $el['width'] ?? '';
            $height = $el['height'] ?? '';

            if (!$src) continue;

            $html .= "
                <img class='story-el story-sticker'
                     data-element-id='{$element_id}'
                     data-element-type='sticker'
                     src='{$src}'
                     style='
                        position:absolute;
                        top: {$y}%;
                        left: {$x}%;
                        width: {$width}px;
                        height: {$height}px;
                        z-index: {$z};
                     '>
            ";
        }

        if ($type === 'button') {

            $label = sanitize_text_field($el['label'] ?? 'Button');
            $url = esc_url($el['url'] ?? '');
            $fontFamily = kosher_sanitize_story_font_family($el['fontFamily'] ?? 'Arial', 'Arial');
            $size = max(10, min(200, intval($el['size'] ?? 18)));
            $color = kosher_sanitize_story_color($el['color'] ?? '#ffffff', '#ffffff');
            $bg = kosher_sanitize_story_color($el['bg'] ?? '#000000', '#000000');
            $borderColor = kosher_sanitize_story_color($el['borderColor'] ?? '#000000', '#000000');
            $borderWidth = max(0, intval($el['borderWidth'] ?? 1));
            $button_size = kosher_get_button_size($el['buttonSize'] ?? 'sm');
            $href = $url ?: '#';

            $html .= "
                <a href='{$href}'
                   target='_blank'
                   rel='noopener noreferrer'
                   class='story-el story-button kosher-btn kosher-btn-{$button_size}'
                   data-element-id='{$element_id}'
                   data-element-type='button'
                   style='
                        position:absolute;
                        top: {$y}%;
                        left: {$x}%;
                        z-index: {$z};
                        font-family: {$fontFamily} !important;
                        font-size: {$size}px !important;
                        color: {$color};
                        background: {$bg};
                        border: {$borderWidth}px solid {$borderColor};
                   '>
                    {$label}
                </a>
            ";
        }

        if ($type === 'poll') {
            $poll_id = absint($el['pollId'] ?? 0);
            $poll_markup = kayco_get_story_poll_markup($poll_id);

            if (!$poll_id || $poll_markup === '') {
                continue;
            }

            $poll_size = max(55, min(100, intval($el['size'] ?? ($el['width'] ?? 100))));
            $poll_scale = $poll_size / 100;

            $html .= "
                <div class='story-el story-poll'
                    data-element-id='{$element_id}'
                    data-element-type='poll'
                    data-poll-id='{$poll_id}'
                    style='
                        position:absolute;
                        top: {$y}%;
                        left: {$x}%;
                        --poll-scale: {$poll_scale};
                        z-index: {$z};
                    '>
                    {$poll_markup}
                </div>
            ";

            continue;
        }

        // =========================
        // SHAPES
        // =========================
        if ($type === 'shape') {

            $shape = sanitize_key($el['shape'] ?? 'square');

            $width  = max(1, intval($el['width'] ?? 100));
            $height = max(1, intval($el['height'] ?? 100));

            $bg = kosher_sanitize_story_color($el['bg'] ?? '#ff0000', '#ff0000');

            $borderColor = kosher_sanitize_story_color($el['borderColor'] ?? '#000000', '#000000');
            $borderWidth = max(0, intval($el['borderWidth'] ?? 0));

            $lineColor = kosher_sanitize_story_color($el['lineColor'] ?? '#000000', '#000000');
            $lineThickness = max(1, intval($el['lineThickness'] ?? 3));

            // TRIANGLE
            if ($shape === 'triangle') {

                $half = $width / 2;

                $html .= "
                    <div class='story-el story-shape story-shape-triangle'
                        data-element-id='{$element_id}'
                        data-element-type='shape'
                        style='
                        position:absolute;
                        top: {$y}%;
                        left: {$x}%;
                        width: 0;
                        height: 0;
                        border-left: {$half}px solid transparent;
                        border-right: {$half}px solid transparent;
                        border-bottom: {$height}px solid {$bg};
                        z-index: {$z};
                    '></div>
                ";

                continue;
            }

            // LINE
            if ($shape === 'line') {

                $html .= "
                    <div class='story-el story-shape story-shape-line'
                        data-element-id='{$element_id}'
                        data-element-type='shape'
                        style='
                        position:absolute;
                        top: {$y}%;
                        left: {$x}%;
                        width: {$width}px;
                        height: {$lineThickness}px;
                        background: {$lineColor};
                        z-index: {$z};
                    '></div>
                ";

                continue;
            }

            // SQUARE / CIRCLE
            $radius = ($shape === 'circle') ? '50%' : '0';

            $html .= "
                <div class='story-el story-shape story-shape-{$shape}'
                    data-element-id='{$element_id}'
                    data-element-type='shape'
                    style='
                    position:absolute;
                    top: {$y}%;
                    left: {$x}%;
                    width: {$width}px;
                    height: {$height}px;
                    background: {$bg};
                    border: {$borderWidth}px solid {$borderColor};
                    border-radius: {$radius};
                    z-index: {$z};
                '></div>
            ";
        }
    }

    $html .= "</div>";


    return $html;
}

/*
|--------------------------------------------------------------------------
| AJAX LOAD STORIES
|--------------------------------------------------------------------------
*/
add_action('wp_ajax_kosher_get_category_stories', 'kosher_get_category_stories');
add_action('wp_ajax_nopriv_kosher_get_category_stories', 'kosher_get_category_stories');

function kosher_get_category_stories() {

    $term_id = intval($_POST['term_id']);

    $stories = get_posts([
    'post_type'      => 'stories',
    'post_status'    => 'publish',
    'posts_per_page' => -1,
    'orderby'        => 'date',
    'order'          => 'ASC',
    'meta_query'     => kayco_get_visible_story_meta_query(),
    'tax_query'      => [[
        'taxonomy' => 'story_category',
        'terms'    => $term_id
    ]]
    ]);

    if (empty($stories)) {
        wp_send_json_error();
    }

    $slides = '';
    $bars   = '';
    $index  = 0;

    // 🔥 NEW: collect post IDs for seen logic
    $post_ids = [];

    foreach ($stories as $story) {

        $post_ids[] = $story->ID;

        $data = get_post_meta($story->ID, '_kosher_story_data', true);
        $decoded = json_decode($data, true);

        $settings = $decoded['settings'] ?? [];

        $video    = $settings['video'] ?? '';
        $duration = $settings['duration'] ?? 3000;
        $has_poll = kayco_story_has_poll_element($data);
        $slide_timeout = $has_poll ? 0 : $duration;

        $content = kosher_render_story($data, $story->ID);

        // =========================
        // 🎥 VIDEO SLIDE
        // =========================
        if (!empty($video)) {

            $video = esc_url($video);

            $slides .= "
                <div class='slide video' data-post-id='{$story->ID}' data-timeout='{$slide_timeout}' data-has-poll='" . ($has_poll ? 'true' : 'false') . "'>
                    <video src='{$video}'  autoplay playsinline></video>
                    <div class='overlay'>{$content}</div>
                </div>
            ";

        } else {

            // =========================
            // 🖼️ IMAGE SLIDE
            // =========================
            $slides .= "
                <div class='slide' data-post-id='{$story->ID}' data-timeout='{$slide_timeout}' data-has-poll='" . ($has_poll ? 'true' : 'false') . "'>
                    <div class='overlay'>{$content}</div>
                </div>
            ";
        }

        // =========================
        // PROGRESS BAR (🔥 FIXED)
        // =========================
        $bars .= "
            <div class='bar' data-index='{$index}'>
                <span></span>
            </div>
        ";

        $index++;
    }

    // =========================
    // FINAL STRUCTURE
    // =========================
    $html = "
        <div class='daily-stories'>

            <div class='daily-stories__outer'>
                <div class='daily-stories__container'>
                    {$slides}
                </div>
            </div>

            <div class='progress-bars'>
                {$bars}
            </div>

            <span class='prev-slide'></span>
            <span class='next-slide'></span>

        </div>
    ";

    // 🔥 RETURN post_ids for frontend logic
    wp_send_json_success([
        'html' => $html,
        'post_ids' => $post_ids
    ]);
}

function kosher_stories_create_table() {
    global $wpdb;

    $table = $wpdb->prefix . 'story_views';
    $events_table = $wpdb->prefix . 'story_events';

    $charset_collate = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE $table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        post_id BIGINT UNSIGNED NOT NULL,
        term_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED DEFAULT NULL,
        ip_address VARCHAR(100),
        viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration INT DEFAULT 0,
        KEY post_id (post_id),
        KEY term_id (term_id),
        KEY user_id (user_id),
        KEY viewed_at (viewed_at),
        KEY post_viewed_at (post_id, viewed_at),
        KEY term_viewed_at (term_id, viewed_at)
    ) $charset_collate;";

    $events_sql = "CREATE TABLE $events_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(32) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        post_id BIGINT UNSIGNED NOT NULL,
        term_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED DEFAULT NULL,
        slide_index INT DEFAULT 0,
        total_slides INT DEFAULT 0,
        element_id VARCHAR(80) DEFAULT '',
        element_type VARCHAR(32) DEFAULT '',
        x_percent DECIMAL(6,3) DEFAULT NULL,
        y_percent DECIMAL(6,3) DEFAULT NULL,
        duration INT DEFAULT 0,
        ip_address VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY event_type (event_type),
        KEY session_id (session_id),
        KEY post_event (post_id, event_type),
        KEY term_event (term_id, event_type),
        KEY created_at (created_at)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
    dbDelta($events_sql);
}
register_activation_hook(__FILE__, 'kosher_stories_create_table');

function kosher_stories_ensure_analytics_table() {
    $version = '1.2.0';

    if (get_option('kosher_stories_analytics_db_version') === $version) {
        return;
    }

    kosher_stories_create_table();
    update_option('kosher_stories_analytics_db_version', $version);
}

add_action('admin_init', 'kosher_stories_ensure_analytics_table');

function kosher_get_analytics_filters() {
    $period = sanitize_key($_GET['period'] ?? 'week');
    $allowed_periods = ['today', 'week', 'month', 'year', 'range'];

    if (!in_array($period, $allowed_periods, true)) {
        $period = 'week';
    }

    $timezone = wp_timezone();
    $now = new DateTimeImmutable('now', $timezone);
    $start = $now->modify('-6 days')->setTime(0, 0, 0);
    $end = $now->setTime(23, 59, 59);
    $group = 'day';
    $label = 'Last 7 Days';

    if ($period === 'today') {
        $start = $now->setTime(0, 0, 0);
        $end = $now->setTime(23, 59, 59);
        $group = 'hour';
        $label = 'Today';
    }

    if ($period === 'month') {
        $start = $now->modify('-29 days')->setTime(0, 0, 0);
        $end = $now->setTime(23, 59, 59);
        $group = 'day';
        $label = 'Last 30 Days';
    }

    if ($period === 'year') {
        $start = $now->modify('first day of January this year')->setTime(0, 0, 0);
        $end = $now->setTime(23, 59, 59);
        $group = 'month';
        $label = 'This Year';
    }

    if ($period === 'range') {
        $from = sanitize_text_field($_GET['date_from'] ?? $now->modify('-6 days')->format('Y-m-d'));
        $to = sanitize_text_field($_GET['date_to'] ?? $now->format('Y-m-d'));
        $from_date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $from . ' 00:00:00', $timezone);
        $to_date = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $to . ' 23:59:59', $timezone);

        if ($from_date instanceof DateTimeImmutable && $to_date instanceof DateTimeImmutable) {
            $start = $from_date;
            $end = $to_date;
        }

        if ($start > $end) {
            [$start, $end] = [$end, $start];
        }

        $days = max(1, (int) $start->diff($end)->format('%a') + 1);
        $group = $days > 90 ? 'month' : 'day';
        $label = 'Custom Range';
    }

    return [
        'period' => $period,
        'label' => $label,
        'start' => $start,
        'end' => $end,
        'group' => $group,
        'date_from' => $start->format('Y-m-d'),
        'date_to' => $end->format('Y-m-d'),
        'start_mysql' => $start->format('Y-m-d H:i:s'),
        'end_mysql' => $end->format('Y-m-d H:i:s'),
    ];
}

function kosher_get_analytics_group_sql($group) {
    if ($group === 'hour') {
        return "DATE_FORMAT(viewed_at, '%Y-%m-%d %H:00:00')";
    }

    if ($group === 'month') {
        return "DATE_FORMAT(viewed_at, '%Y-%m-01')";
    }

    return 'DATE(viewed_at)';
}

function kosher_get_analytics_empty_timeline($filters) {
    $items = [];
    $cursor = $filters['start'];
    $end = $filters['end'];
    $group = $filters['group'];

    while ($cursor <= $end) {
        $key = $cursor->format($group === 'hour' ? 'Y-m-d H:00:00' : ($group === 'month' ? 'Y-m-01' : 'Y-m-d'));
        $label = $cursor->format($group === 'hour' ? 'g A' : ($group === 'month' ? 'M Y' : 'M j'));

        $items[$key] = [
            'key' => $key,
            'label' => $label,
            'views' => 0,
            'unique' => 0,
        ];

        if ($group === 'hour') {
            $cursor = $cursor->modify('+1 hour');
        } elseif ($group === 'month') {
            $cursor = $cursor->modify('first day of next month');
        } else {
            $cursor = $cursor->modify('+1 day');
        }
    }

    return $items;
}

function kosher_get_analytics_data($filters = null) {
    global $wpdb;

    kosher_stories_ensure_analytics_table();

    $filters = $filters ?: kosher_get_analytics_filters();
    static $cache = [];

    $cache_key = md5(implode('|', [
        $filters['period'],
        $filters['start_mysql'],
        $filters['end_mysql'],
        $filters['group'],
    ]));

    if (isset($cache[$cache_key])) {
        return $cache[$cache_key];
    }

    $table = $wpdb->prefix . 'story_views';
    $events_table = $wpdb->prefix . 'story_events';
    $start = $filters['start_mysql'];
    $end = $filters['end_mysql'];
    $viewer_sql = "CASE WHEN user_id IS NOT NULL AND user_id > 0 THEN CONCAT('u:', user_id) ELSE CONCAT('ip:', ip_address) END";
    $viewer_sql_aliased = "CASE WHEN v.user_id IS NOT NULL AND v.user_id > 0 THEN CONCAT('u:', v.user_id) ELSE CONCAT('ip:', v.ip_address) END";

    $summary = $wpdb->get_row(
        $wpdb->prepare(
            "SELECT
                COUNT(*) AS total_views,
                COUNT(DISTINCT post_id) AS stories_viewed,
                COUNT(DISTINCT term_id) AS categories_viewed,
                COUNT(DISTINCT {$viewer_sql}) AS unique_viewers,
                COALESCE(AVG(duration), 0) AS avg_duration,
                COALESCE(SUM(duration), 0) AS total_duration
            FROM {$table}
            WHERE viewed_at BETWEEN %s AND %s",
            $start,
            $end
        ),
        ARRAY_A
    );

    $group_sql = kosher_get_analytics_group_sql($filters['group']);
    $timeline_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                {$group_sql} AS period_key,
                COUNT(*) AS views,
                COUNT(DISTINCT {$viewer_sql}) AS unique_viewers
            FROM {$table}
            WHERE viewed_at BETWEEN %s AND %s
            GROUP BY period_key
            ORDER BY period_key ASC",
            $start,
            $end
        ),
        ARRAY_A
    );

    $timeline = kosher_get_analytics_empty_timeline($filters);
    foreach ($timeline_rows as $row) {
        $key = $row['period_key'];
        if (!isset($timeline[$key])) {
            continue;
        }

        $timeline[$key]['views'] = (int) $row['views'];
        $timeline[$key]['unique'] = (int) $row['unique_viewers'];
    }

    $top_stories = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                v.post_id,
                posts.post_title,
                COUNT(*) AS views,
                COUNT(DISTINCT {$viewer_sql_aliased}) AS unique_viewers,
                COALESCE(AVG(v.duration), 0) AS avg_duration,
                MAX(v.viewed_at) AS last_viewed
            FROM {$table} v
            INNER JOIN {$wpdb->posts} posts ON posts.ID = v.post_id
            WHERE v.viewed_at BETWEEN %s AND %s
            GROUP BY v.post_id, posts.post_title
            ORDER BY views DESC
            LIMIT 10",
            $start,
            $end
        ),
        ARRAY_A
    );

    $category_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                v.term_id,
                terms.name,
                COUNT(*) AS views
            FROM {$table} v
            LEFT JOIN {$wpdb->terms} terms ON terms.term_id = v.term_id
            WHERE v.viewed_at BETWEEN %s AND %s
            GROUP BY v.term_id, terms.name
            ORDER BY views DESC
            LIMIT 8",
            $start,
            $end
        ),
        ARRAY_A
    );

    $recent_views = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                v.post_id,
                posts.post_title,
                terms.name AS term_name,
                v.duration,
                v.viewed_at
            FROM {$table} v
            LEFT JOIN {$wpdb->posts} posts ON posts.ID = v.post_id
            LEFT JOIN {$wpdb->terms} terms ON terms.term_id = v.term_id
            WHERE v.viewed_at BETWEEN %s AND %s
            ORDER BY v.viewed_at DESC
            LIMIT 8",
            $start,
            $end
        ),
        ARRAY_A
    );

    $event_summary = $wpdb->get_row(
        $wpdb->prepare(
            "SELECT
                COUNT(DISTINCT CASE WHEN event_type = 'view' THEN session_id END) AS view_sessions,
                COUNT(DISTINCT CASE WHEN event_type = 'complete' THEN session_id END) AS complete_sessions,
                SUM(CASE WHEN event_type = 'dropoff' THEN 1 ELSE 0 END) AS dropoffs,
                SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) AS clicks,
                SUM(CASE WHEN event_type = 'heatmap' THEN 1 ELSE 0 END) AS heatmap_points
            FROM {$events_table}
            WHERE created_at BETWEEN %s AND %s",
            $start,
            $end
        ),
        ARRAY_A
    );

    $dropoff_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                e.post_id,
                posts.post_title,
                e.slide_index,
                MAX(e.total_slides) AS total_slides,
                COUNT(*) AS exits
            FROM {$events_table} e
            LEFT JOIN {$wpdb->posts} posts ON posts.ID = e.post_id
            WHERE e.created_at BETWEEN %s AND %s
                AND e.event_type = 'dropoff'
            GROUP BY e.post_id, posts.post_title, e.slide_index
            ORDER BY exits DESC
            LIMIT 10",
            $start,
            $end
        ),
        ARRAY_A
    );

    $click_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                e.post_id,
                posts.post_title,
                e.element_id,
                e.element_type,
                COUNT(*) AS clicks,
                MAX(e.created_at) AS last_clicked
            FROM {$events_table} e
            LEFT JOIN {$wpdb->posts} posts ON posts.ID = e.post_id
            WHERE e.created_at BETWEEN %s AND %s
                AND e.event_type = 'click'
                AND e.element_id <> ''
            GROUP BY e.post_id, posts.post_title, e.element_id, e.element_type
            ORDER BY clicks DESC
            LIMIT 10",
            $start,
            $end
        ),
        ARRAY_A
    );

    $category_performance_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                v.term_id,
                terms.name,
                COUNT(*) AS views,
                COUNT(DISTINCT {$viewer_sql_aliased}) AS unique_viewers,
                COALESCE(AVG(v.duration), 0) AS avg_duration
            FROM {$table} v
            LEFT JOIN {$wpdb->terms} terms ON terms.term_id = v.term_id
            WHERE v.viewed_at BETWEEN %s AND %s
            GROUP BY v.term_id, terms.name
            ORDER BY views DESC
            LIMIT 10",
            $start,
            $end
        ),
        ARRAY_A
    );

    $category_event_rows = $wpdb->get_results(
        $wpdb->prepare(
            "SELECT
                term_id,
                COUNT(DISTINCT CASE WHEN event_type = 'view' THEN session_id END) AS view_sessions,
                COUNT(DISTINCT CASE WHEN event_type = 'complete' THEN session_id END) AS complete_sessions
            FROM {$events_table}
            WHERE created_at BETWEEN %s AND %s
            GROUP BY term_id",
            $start,
            $end
        ),
        ARRAY_A
    );

    $category_event_map = [];
    foreach ($category_event_rows ?: [] as $row) {
        $category_event_map[(int) $row['term_id']] = [
            'view_sessions' => (int) $row['view_sessions'],
            'complete_sessions' => (int) $row['complete_sessions'],
        ];
    }

    $view_sessions = (int) ($event_summary['view_sessions'] ?? 0);
    $complete_sessions = (int) ($event_summary['complete_sessions'] ?? 0);

    $cache[$cache_key] = [
        'filters' => $filters,
        'summary' => [
            'total_views' => (int) ($summary['total_views'] ?? 0),
            'stories_viewed' => (int) ($summary['stories_viewed'] ?? 0),
            'categories_viewed' => (int) ($summary['categories_viewed'] ?? 0),
            'unique_viewers' => (int) ($summary['unique_viewers'] ?? 0),
            'avg_duration' => (float) ($summary['avg_duration'] ?? 0),
            'total_duration' => (int) ($summary['total_duration'] ?? 0),
            'completion_rate' => $view_sessions > 0 ? round(($complete_sessions / $view_sessions) * 100, 1) : 0,
            'dropoffs' => (int) ($event_summary['dropoffs'] ?? 0),
            'clicks' => (int) ($event_summary['clicks'] ?? 0),
            'heatmap_points' => (int) ($event_summary['heatmap_points'] ?? 0),
        ],
        'timeline' => array_values($timeline),
        'top_stories' => array_map(function ($story) {
            $story['views'] = (int) $story['views'];
            $story['unique_viewers'] = (int) $story['unique_viewers'];
            $story['avg_duration'] = (float) $story['avg_duration'];
            $terms = wp_get_post_terms((int) $story['post_id'], 'story_category', ['fields' => 'names']);
            $story['category'] = is_wp_error($terms) ? '' : implode(', ', $terms);
            return $story;
        }, $top_stories ?: []),
        'categories' => array_map(function ($category) {
            return [
                'name' => $category['name'] ?: 'Uncategorized',
                'views' => (int) $category['views'],
            ];
        }, $category_rows ?: []),
        'recent_views' => $recent_views ?: [],
        'dropoffs' => array_map(function ($dropoff) {
            return [
                'post_id' => (int) $dropoff['post_id'],
                'post_title' => $dropoff['post_title'] ?: 'Untitled Story',
                'slide_index' => (int) $dropoff['slide_index'],
                'total_slides' => (int) $dropoff['total_slides'],
                'exits' => (int) $dropoff['exits'],
            ];
        }, $dropoff_rows ?: []),
        'element_clicks' => array_map(function ($click) {
            return [
                'post_id' => (int) $click['post_id'],
                'post_title' => $click['post_title'] ?: 'Untitled Story',
                'element_id' => $click['element_id'] ?: '',
                'element_type' => $click['element_type'] ?: '',
                'clicks' => (int) $click['clicks'],
                'last_clicked' => $click['last_clicked'] ?: '',
            ];
        }, $click_rows ?: []),
        'category_performance' => array_map(function ($category) use ($category_event_map) {
            $term_id = (int) $category['term_id'];
            $events = $category_event_map[$term_id] ?? ['view_sessions' => 0, 'complete_sessions' => 0];
            $view_sessions = (int) $events['view_sessions'];
            $complete_sessions = (int) $events['complete_sessions'];

            return [
                'term_id' => $term_id,
                'name' => $category['name'] ?: 'Uncategorized',
                'views' => (int) $category['views'],
                'unique_viewers' => (int) $category['unique_viewers'],
                'avg_duration' => (float) $category['avg_duration'],
                'completion_rate' => $view_sessions > 0 ? round(($complete_sessions / $view_sessions) * 100, 1) : 0,
            ];
        }, $category_performance_rows ?: []),
    ];

    return $cache[$cache_key];
}

function kosher_get_analytics_chart_data() {
    $data = kosher_get_analytics_data();

    return [
        'timeline' => [
            'labels' => wp_list_pluck($data['timeline'], 'label'),
            'views' => wp_list_pluck($data['timeline'], 'views'),
            'unique' => wp_list_pluck($data['timeline'], 'unique'),
        ],
        'topStories' => [
            'labels' => array_map(function ($story) {
                return wp_html_excerpt($story['post_title'] ?: 'Untitled Story', 28, '...');
            }, $data['top_stories']),
            'views' => wp_list_pluck($data['top_stories'], 'views'),
        ],
        'categories' => [
            'labels' => wp_list_pluck($data['categories'], 'name'),
            'views' => wp_list_pluck($data['categories'], 'views'),
        ],
        'dropoffs' => [
            'labels' => array_map(function ($dropoff) {
                return wp_html_excerpt($dropoff['post_title'] ?: 'Untitled Story', 18, '...') . ' #' . ((int) $dropoff['slide_index'] + 1);
            }, $data['dropoffs']),
            'exits' => wp_list_pluck($data['dropoffs'], 'exits'),
        ],
    ];
}

function kosher_format_analytics_duration($milliseconds) {
    $seconds = max(0, (int) round($milliseconds / 1000));

    if ($seconds < 60) {
        return $seconds . 's';
    }

    $minutes = floor($seconds / 60);
    $remaining = $seconds % 60;

    return $minutes . 'm ' . str_pad((string) $remaining, 2, '0', STR_PAD_LEFT) . 's';
}

function kayco_format_analytics_percentage($value) {
    $value = max(0, min(100, (float) $value));
    return rtrim(rtrim(number_format_i18n($value, 1), '0'), '.') . '%';
}

function kosher_render_analytics_page() {
    if (!current_user_can('edit_posts')) {
        wp_die(esc_html__('You do not have permission to view story analytics.', 'kosher-stories'));
    }

    $data = kosher_get_analytics_data();
    $filters = $data['filters'];
    $summary = $data['summary'];
    $periods = [
        'today' => 'Today',
        'week' => '7 Days',
        'month' => '30 Days',
        'year' => 'Year',
        'range' => 'Custom',
    ];
    ?>
    <div class="wrap kosher-analytics-page">
        <div class="kosher-analytics-hero">
            <div>
                <span class="kosher-analytics-kicker"><i class="bi bi-graph-up-arrow"></i> Story Analytics</span>
                <h1>Performance Dashboard</h1>
                <p>Track story views, viewer reach, watch time, and category performance with a professional reporting view.</p>
            </div>
            <div class="kosher-analytics-range-card">
                <span><?php echo esc_html($filters['label']); ?></span>
                <strong><?php echo esc_html($filters['start']->format('M j, Y')); ?> - <?php echo esc_html($filters['end']->format('M j, Y')); ?></strong>
            </div>
        </div>

        <form class="kosher-analytics-filters" method="get">
            <input type="hidden" name="post_type" value="stories">
            <input type="hidden" name="page" value="kosher-stories-analytics">

            <div class="kosher-analytics-tabs" role="tablist" aria-label="Analytics period">
                <?php foreach ($periods as $period_key => $period_label) : ?>
                    <label class="<?php echo $filters['period'] === $period_key ? 'is-active' : ''; ?>">
                        <input type="radio" name="period" value="<?php echo esc_attr($period_key); ?>" <?php checked($filters['period'], $period_key); ?>>
                        <span><?php echo esc_html($period_label); ?></span>
                    </label>
                <?php endforeach; ?>
            </div>

            <div class="kosher-analytics-date-fields">
                <label>
                    <span>From</span>
                    <input type="date" name="date_from" value="<?php echo esc_attr($filters['date_from']); ?>">
                </label>
                <label>
                    <span>To</span>
                    <input type="date" name="date_to" value="<?php echo esc_attr($filters['date_to']); ?>">
                </label>
                <button type="submit"><i class="bi bi-funnel"></i> Apply Filters</button>
            </div>
        </form>

        <div class="kosher-analytics-stats">
            <div class="kosher-stat-card">
                <i class="bi bi-eye"></i>
                <span>Total Views</span>
                <strong><?php echo esc_html(number_format_i18n($summary['total_views'])); ?></strong>
            </div>
            <div class="kosher-stat-card">
                <i class="bi bi-people"></i>
                <span>Unique Viewers</span>
                <strong><?php echo esc_html(number_format_i18n($summary['unique_viewers'])); ?></strong>
            </div>
            <div class="kosher-stat-card">
                <i class="bi bi-collection-play"></i>
                <span>Stories Viewed</span>
                <strong><?php echo esc_html(number_format_i18n($summary['stories_viewed'])); ?></strong>
            </div>
            <div class="kosher-stat-card">
                <i class="bi bi-clock-history"></i>
                <span>Avg. Watch Time</span>
                <strong><?php echo esc_html(kosher_format_analytics_duration($summary['avg_duration'])); ?></strong>
            </div>
            <div class="kosher-stat-card">
                <i class="bi bi-hourglass-split"></i>
                <span>Total Watch Time</span>
                <strong><?php echo esc_html(kosher_format_analytics_duration($summary['total_duration'])); ?></strong>
            </div>
            <div class="kosher-stat-card">
                <i class="bi bi-check2-circle"></i>
                <span>Completion Rate</span>
                <strong><?php echo esc_html(kayco_format_analytics_percentage($summary['completion_rate'])); ?></strong>
            </div>
            <div class="kosher-stat-card">
                <i class="bi bi-cursor"></i>
                <span>Element Clicks</span>
                <strong><?php echo esc_html(number_format_i18n($summary['clicks'])); ?></strong>
            </div>
            <div class="kosher-stat-card">
                <i class="bi bi-bullseye"></i>
                <span>Tap Heatmap Points</span>
                <strong><?php echo esc_html(number_format_i18n($summary['heatmap_points'])); ?></strong>
            </div>
        </div>

        <div class="kosher-analytics-grid">
            <section class="kosher-chart-card kosher-chart-card--wide">
                <div class="kosher-chart-head">
                    <div>
                        <span>Timeline</span>
                        <h2>Views Over Time</h2>
                    </div>
                    <i class="bi bi-activity"></i>
                </div>
                <div class="kosher-chart-wrap">
                    <canvas id="kosherViewsChart"></canvas>
                </div>
            </section>

            <section class="kosher-chart-card">
                <div class="kosher-chart-head">
                    <div>
                        <span>Distribution</span>
                        <h2>Category Views</h2>
                    </div>
                    <i class="bi bi-pie-chart"></i>
                </div>
                <div class="kosher-chart-wrap">
                    <canvas id="kosherCategoryChart"></canvas>
                </div>
            </section>

            <section class="kosher-chart-card">
                <div class="kosher-chart-head">
                    <div>
                        <span>Ranking</span>
                        <h2>Top Stories</h2>
                    </div>
                    <i class="bi bi-bar-chart"></i>
                </div>
                <div class="kosher-chart-wrap">
                    <canvas id="kosherTopStoriesChart"></canvas>
                </div>
            </section>

            <section class="kosher-chart-card">
                <div class="kosher-chart-head">
                    <div>
                        <span>Friction</span>
                        <h2>Drop-Off Hotspots</h2>
                    </div>
                    <i class="bi bi-sign-stop"></i>
                </div>
                <div class="kosher-chart-wrap">
                    <canvas id="kosherDropoffChart"></canvas>
                </div>
            </section>
        </div>

        <div class="kosher-analytics-tables">
            <section class="kosher-table-card">
                <div class="kosher-table-head">
                    <h2>Story Performance</h2>
                    <span>Top 10 by views</span>
                </div>
                <?php if (!empty($data['top_stories'])) : ?>
                    <table>
                        <thead>
                            <tr>
                                <th>Story</th>
                                <th>Category</th>
                                <th>Views</th>
                                <th>Unique</th>
                                <th>Avg. Time</th>
                                <th>Last View</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($data['top_stories'] as $story) : ?>
                                <tr>
                                    <td>
                                        <strong><?php echo esc_html($story['post_title'] ?: 'Untitled Story'); ?></strong>
                                        <a href="<?php echo esc_url(get_edit_post_link((int) $story['post_id'])); ?>">Edit story</a>
                                    </td>
                                    <td><?php echo esc_html($story['category'] ?: 'Uncategorized'); ?></td>
                                    <td><?php echo esc_html(number_format_i18n($story['views'])); ?></td>
                                    <td><?php echo esc_html(number_format_i18n($story['unique_viewers'])); ?></td>
                                    <td><?php echo esc_html(kosher_format_analytics_duration($story['avg_duration'])); ?></td>
                                    <td><?php echo esc_html(mysql2date('M j, g:i A', $story['last_viewed'])); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?>
                    <div class="kosher-empty-analytics">
                        <i class="bi bi-bar-chart-line"></i>
                        <strong>No story views yet</strong>
                        <p>Once visitors start opening stories, performance data will appear here.</p>
                    </div>
                <?php endif; ?>
            </section>

            <section class="kosher-table-card">
                <div class="kosher-table-head">
                    <h2>Recent Views</h2>
                    <span>Latest activity</span>
                </div>
                <?php if (!empty($data['recent_views'])) : ?>
                    <table>
                        <thead>
                            <tr>
                                <th>Story</th>
                                <th>Category</th>
                                <th>Duration</th>
                                <th>Viewed</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($data['recent_views'] as $view) : ?>
                                <tr>
                                    <td><?php echo esc_html($view['post_title'] ?: 'Untitled Story'); ?></td>
                                    <td><?php echo esc_html($view['term_name'] ?: 'Uncategorized'); ?></td>
                                    <td><?php echo esc_html(kosher_format_analytics_duration($view['duration'])); ?></td>
                                    <td><?php echo esc_html(mysql2date('M j, g:i A', $view['viewed_at'])); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?>
                    <div class="kosher-empty-analytics">
                        <i class="bi bi-clock"></i>
                        <strong>No recent activity</strong>
                        <p>Try expanding the date range or visit a story on the frontend.</p>
                    </div>
                <?php endif; ?>
            </section>
        </div>

        <div class="kosher-analytics-tables kosher-analytics-tables--engagement">
            <section class="kosher-table-card">
                <div class="kosher-table-head">
                    <h2>Category Performance</h2>
                    <span>Views, completion, and watch time by taxonomy</span>
                </div>
                <?php if (!empty($data['category_performance'])) : ?>
                    <table>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Views</th>
                                <th>Unique</th>
                                <th>Completion</th>
                                <th>Avg. Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($data['category_performance'] as $category) : ?>
                                <tr>
                                    <td><strong><?php echo esc_html($category['name']); ?></strong></td>
                                    <td><?php echo esc_html(number_format_i18n($category['views'])); ?></td>
                                    <td><?php echo esc_html(number_format_i18n($category['unique_viewers'])); ?></td>
                                    <td><?php echo esc_html(kayco_format_analytics_percentage($category['completion_rate'])); ?></td>
                                    <td><?php echo esc_html(kosher_format_analytics_duration($category['avg_duration'])); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?>
                    <div class="kosher-empty-analytics">
                        <i class="bi bi-diagram-3"></i>
                        <strong>No category data yet</strong>
                        <p>Category-level performance appears after stories are viewed.</p>
                    </div>
                <?php endif; ?>
            </section>

            <section class="kosher-table-card">
                <div class="kosher-table-head">
                    <h2>Drop-Off Tracking</h2>
                    <span>Where viewers exit</span>
                </div>
                <?php if (!empty($data['dropoffs'])) : ?>
                    <table>
                        <thead>
                            <tr>
                                <th>Story</th>
                                <th>Slide</th>
                                <th>Exits</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($data['dropoffs'] as $dropoff) : ?>
                                <tr>
                                    <td>
                                        <strong><?php echo esc_html($dropoff['post_title']); ?></strong>
                                        <a href="<?php echo esc_url(get_edit_post_link((int) $dropoff['post_id'])); ?>">Edit story</a>
                                    </td>
                                    <td><?php echo esc_html(((int) $dropoff['slide_index'] + 1) . ' of ' . max(1, (int) $dropoff['total_slides'])); ?></td>
                                    <td><?php echo esc_html(number_format_i18n($dropoff['exits'])); ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?>
                    <div class="kosher-empty-analytics">
                        <i class="bi bi-sign-stop"></i>
                        <strong>No drop-offs recorded</strong>
                        <p>Drop-offs are captured when a viewer exits before finishing the story group.</p>
                    </div>
                <?php endif; ?>
            </section>

            <section class="kosher-table-card">
                <div class="kosher-table-head">
                    <h2>Element Clicks</h2>
                    <span>Clickable layer engagement</span>
                </div>
                <?php if (!empty($data['element_clicks'])) : ?>
                    <table>
                        <thead>
                            <tr>
                                <th>Story</th>
                                <th>Element</th>
                                <th>Clicks</th>
                                <th>Last Click</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($data['element_clicks'] as $click) : ?>
                                <tr>
                                    <td>
                                        <strong><?php echo esc_html($click['post_title']); ?></strong>
                                        <a href="<?php echo esc_url(get_edit_post_link((int) $click['post_id'])); ?>">Edit story</a>
                                    </td>
                                    <td><?php echo esc_html($click['element_type'] . ' - ' . $click['element_id']); ?></td>
                                    <td><?php echo esc_html(number_format_i18n($click['clicks'])); ?></td>
                                    <td><?php echo $click['last_clicked'] ? esc_html(mysql2date('M j, g:i A', $click['last_clicked'])) : '-'; ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?>
                    <div class="kosher-empty-analytics">
                        <i class="bi bi-cursor"></i>
                        <strong>No element clicks yet</strong>
                        <p>Clicks on text, stickers, buttons, and clickable shapes are stored here.</p>
                    </div>
                <?php endif; ?>
            </section>
        </div>
    </div>
    <?php
}

add_action('wp_ajax_kosher_track_story_view', 'kosher_track_story_view');
add_action('wp_ajax_nopriv_kosher_track_story_view', 'kosher_track_story_view');
add_action('wp_ajax_kayco_track_story_events', 'kayco_track_story_events');
add_action('wp_ajax_nopriv_kayco_track_story_events', 'kayco_track_story_events');

function kosher_track_story_view() {

    global $wpdb;

    kosher_stories_ensure_analytics_table();

    $table = $wpdb->prefix . 'story_views';

    $post_id = intval($_POST['post_id']);
    $term_id = intval($_POST['term_id']);
    $user_id = get_current_user_id() ?: null;
    $ip      = $_SERVER['REMOTE_ADDR'] ?? '';
    $duration = intval($_POST['duration']);

    if (!$post_id || !$term_id) {
        wp_send_json_error();
    }

    $wpdb->insert($table, [
        'post_id'    => $post_id,
        'term_id'    => $term_id,
        'user_id'    => $user_id,
        'ip_address' => sanitize_text_field($ip),
        'viewed_at'  => current_time('mysql'),
        'duration'   => $duration,
    ]);

    wp_send_json_success();
}

function kayco_track_story_events() {
    global $wpdb;

    kosher_stories_ensure_analytics_table();

    $raw_events = wp_unslash($_POST['events'] ?? '[]');
    $events = json_decode($raw_events, true);

    if (!is_array($events) || empty($events)) {
        wp_send_json_error(['message' => 'No events supplied'], 400);
    }

    $table = $wpdb->prefix . 'story_events';
    $allowed_types = ['view', 'complete', 'dropoff', 'click', 'heatmap'];
    $user_id = get_current_user_id() ?: null;
    $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
    $inserted = 0;

    foreach (array_slice($events, 0, 40) as $event) {
        if (!is_array($event)) {
            continue;
        }

        $event_type = sanitize_key($event['eventType'] ?? '');
        $post_id = intval($event['postId'] ?? 0);
        $term_id = intval($event['termId'] ?? 0);

        if (!$post_id || !$term_id || !in_array($event_type, $allowed_types, true)) {
            continue;
        }

        $result = $wpdb->insert($table, [
            'event_type' => $event_type,
            'session_id' => sanitize_text_field($event['sessionId'] ?? ''),
            'post_id' => $post_id,
            'term_id' => $term_id,
            'user_id' => $user_id,
            'slide_index' => max(0, intval($event['slideIndex'] ?? 0)),
            'total_slides' => max(0, intval($event['totalSlides'] ?? 0)),
            'element_id' => sanitize_text_field($event['elementId'] ?? ''),
            'element_type' => sanitize_key($event['elementType'] ?? ''),
            'x_percent' => isset($event['xPercent']) ? max(0, min(100, floatval($event['xPercent']))) : null,
            'y_percent' => isset($event['yPercent']) ? max(0, min(100, floatval($event['yPercent']))) : null,
            'duration' => max(0, intval($event['duration'] ?? 0)),
            'ip_address' => $ip,
            'created_at' => current_time('mysql'),
        ]);

        if ($result !== false) {
            $inserted++;
        }
    }

    wp_send_json_success(['inserted' => $inserted]);
}

add_action('wp_ajax_kosher_get_story_ids', 'kosher_get_story_ids');
add_action('wp_ajax_nopriv_kosher_get_story_ids', 'kosher_get_story_ids');

function kosher_get_story_ids() {

    $term_id = intval($_POST['term_id']);

    $stories = get_posts([
        'post_type' => 'stories',
        'post_status' => 'publish',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'meta_query' => kayco_get_visible_story_meta_query(),
        'tax_query' => [[
            'taxonomy' => 'story_category',
            'terms' => $term_id
        ]]
    ]);

    wp_send_json_success([
        'post_ids' => $stories
    ]);
}

add_action('wp_ajax_kosher_get_story_thumb', 'kosher_get_story_thumb');
add_action('wp_ajax_nopriv_kosher_get_story_thumb', 'kosher_get_story_thumb');

function kosher_get_story_thumb() {

    $term_id = intval($_POST['term_id']);

    $stories = get_posts([
        'post_type'      => 'stories',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => 'date',
        'order'          => 'ASC',
        'meta_query'     => kayco_get_visible_story_meta_query(),
        'tax_query'      => [[
            'taxonomy' => 'story_category',
            'terms'    => $term_id
        ]]
    ]);

    if (empty($stories)) {
        wp_send_json_error();
    }

    $result = [];

    foreach ($stories as $story) {

        $img = '';

        // =========================
        // ✅ YOUR CUSTOM FIELD (JSON)
        // =========================
        $raw = get_post_meta($story->ID, '_kosher_story_data', true);

        if (!empty($raw)) {

            $data = kosher_normalize_story_data($raw);

            if (
                is_array($data) &&
                isset($data['settings']) &&
                isset($data['settings']['image']) &&
                !empty($data['settings']['image'])
            ) {
                $img = $data['settings']['image'];
            }
        }

        if (empty($img) && has_post_thumbnail($story->ID)) {
            $img = get_the_post_thumbnail_url($story->ID, 'full') ?: '';
        }

        // =========================
        // ✅ FINAL SAFETY (ALWAYS STRING)
        // =========================
        if (empty($img)) {
            $img = '';
        }

        $result[] = [
            'id'  => (string) $story->ID,
            'img' => $img
        ];
    }

    wp_send_json_success($result);
}
