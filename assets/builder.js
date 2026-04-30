jQuery(function ($) {
    const DEFAULT_DURATION = 3000;
    const MIN_DURATION = 1000;
    const MAX_DURATION = 15000;
    const HISTORY_LIMIT = 50;
    const CLIPBOARD_KEY = 'kayco_story_builder_clipboard';
    const DEBUG_KEY = 'kayco_story_builder_debug';
    const BUTTON_SIZE_KEYS = ['xs', 'sm', 'md', 'lg', 'xl'];

    const state = {
        elements: [],
        selectedIndex: null,
        builder: {
            gridEnabled: false,
            snapEnabled: true,
            gridSize: 20
        },
        history: {
            undoStack: [],
            redoStack: [],
            isRestoring: false,
            debounceTimer: null
        },
        templates: [],
        polls: [],
        mediaFrames: {
            image: null,
            video: null
        }
    };

    const dom = {
        canvas: $('#kosher-canvas'),
        previewShell: $('.kosher-preview-shell'),
        form: $('form#post'),
        storyData: $('#kosher_story_data'),
        durationInput: $('#story-duration'),
        durationDisplay: $('#story-duration-value'),
        backgroundColor: $('#story-background-color'),
        backgroundImage: $('#story-background-image'),
        backgroundVideo: $('#story-background-video'),
        backgroundImagePreview: $('#bg-image-preview'),
        backgroundVideoPreview: $('#bg-video-preview'),
        removeBackgroundImage: $('#remove-bg-image'),
        removeBackgroundVideo: $('#remove-bg-video'),
        imagePreviewWrap: $('.preview-wrap-image'),
        videoPreviewWrap: $('.preview-wrap-video'),
        stickerDropdown: $('#sticker-dropdown'),
        stickerList: $('.sticker-list'),
        textSettings: $('#text-settings'),
        buttonSettings: $('#button-settings'),
        pollSettings: $('#poll-settings'),
        stickerSettings: $('#sticker-settings'),
        shapeSettings: $('#shape-settings'),
        lineSettings: $('#line-settings'),
        settingsEmpty: $('#settings-empty'),
        fontSize: $('#font-size'),
        fontFamily: $('#font-family'),
        textColor: $('#text-color'),
        textPadding: $('#text-padding'),
        textLineHeight: $('#text-line-height'),
        textBackground: $('#bg-color'),
        buttonLabel: $('#button-label'),
        buttonUrl: $('#button-url'),
        buttonFontSize: $('#button-font-size'),
        buttonFontFamily: $('#button-font-family'),
        buttonColor: $('#button-color'),
        buttonBackground: $('#button-background'),
        buttonBorderColor: $('#button-border-color'),
        buttonBorderWidth: $('#button-border-width'),
        buttonSize: $('#button-size'),
        pollSelect: $('#poll-select'),
        pollWidth: $('#poll-width'),
        pollStatus: $('#poll-settings-status'),
        stickerSize: $('#sticker-size'),
        shapeType: $('#shape-type'),
        shapeBackground: $('#shape-bg'),
        shapeBorder: $('#shape-border'),
        shapeBorderWidth: $('#shape-border-width'),
        shapeWidth: $('#shape-width'),
        shapeHeight: $('#shape-height'),
        lineColor: $('#line-color'),
        lineThickness: $('#line-thickness'),
        deleteElement: $('#delete-el'),
        gridToggle: $('#builder-grid-toggle'),
        snapToggle: $('#builder-snap-toggle'),
        undo: $('#builder-undo'),
        redo: $('#builder-redo'),
        templateName: $('#template-name'),
        templateList: $('#template-list'),
        templatePreview: $('#template-preview'),
        templateSave: $('#template-save'),
        templateLoad: $('#template-load'),
        templateMerge: $('#template-merge'),
        templateDelete: $('#template-delete'),
        layerList: $('#builder-layer-list')
    };

    init();

    function init() {
        syncDurationDisplay(getDurationValue());
        loadState();
        bindEditor();
        bindEvents();
        render();
        updateSettingsPanel();
        updateRemoveButtons();
        pushHistorySnapshot();
        loadPolls();
        loadTemplates();
    }

    function bindEvents() {
        bindDurationEvents();
        bindBackgroundEvents();
        bindTransparentColorEvents();
        bindStickerEvents();
        bindElementActions();
        bindTextSettingsEvents();
        bindButtonSettingsEvents();
        bindPollSettingsEvents();
        bindShapeSettingsEvents();
        bindBuilderTools();
        bindLayerPanelEvents();
        bindKeyboardShortcuts();
        bindCanvasEvents();
        bindViewportEvents();
        bindFormEvents();
    }

    function bindDurationEvents() {
        dom.durationInput.on('input', function () {
            syncDurationDisplay(getDurationValue());
            save();
            queueHistorySnapshot();
        });
    }

    function bindBackgroundEvents() {
        $('#select-bg-video').on('click', function (event) {
            event.preventDefault();
            openBackgroundVideoFrame();
        });

        $('#select-bg-image').on('click', function (event) {
            event.preventDefault();
            openBackgroundImageFrame();
        });

        dom.removeBackgroundVideo.on('click', function () {
            clearBackgroundAsset('video');
        });

        dom.removeBackgroundImage.on('click', function () {
            clearBackgroundAsset('image');
        });

        dom.backgroundColor.on('input', function () {
            setColorFieldValue(dom.backgroundColor, dom.backgroundColor.val(), '#000000');
            applyCanvasBackground();
            save();
            queueHistorySnapshot();
        });
    }

    function bindTransparentColorEvents() {
        $('.transparent-toggle').on('click', function (event) {
            event.preventDefault();

            const $input = $($(this).data('target'));
            if (!$input.length) {
                return;
            }

            setColorFieldValue($input, 'transparent', '#000000');
            applyTransparentColorSelection($input);
        });
    }

    function bindStickerEvents() {
        $('.add-sticker').on('click', function (event) {
            event.stopPropagation();

            dom.stickerDropdown.toggleClass('hidden');

            if (!dom.stickerDropdown.data('loaded')) {
                loadStickers();
                dom.stickerDropdown.data('loaded', true);
            }
        });

        dom.stickerDropdown.on('click', '.sticker-item', function () {
            addElement({
                type: 'sticker',
                src: $(this).attr('src'),
                x: 50,
                y: 50,
                width: 120,
                height: 120,
                z: 1
            });
        });

        dom.stickerDropdown.on('click', function (event) {
            event.stopPropagation();
        });

        $(document).on('click', function () {
            dom.stickerDropdown.addClass('hidden');
        });

        dom.stickerSize.on('input', function () {
            const maxSize = Math.min(...Object.values(getCanvasSize()));
            let size = parseInt(this.value, 10) || 120;

            size = Math.max(10, size);
            size = Math.min(maxSize, size);

            updateSelectedElement('sticker', function (element) {
                element.width = size;
                element.height = size;
            });
        });
    }

    function bindElementActions() {
        $('.add-text').on('click', function () {
            addElement(createDefaultTextElement());
        });

        $('.add-button').on('click', function () {
            addElement(createDefaultButtonElement());
        });

        $('.add-poll').on('click', function () {
            ensurePollsLoaded(function () {
                if (!state.polls.length) {
                    alert('Create at least one published poll first.');
                    return;
                }

                const element = createDefaultPollElement();
                element.pollId = state.polls[0].id;
                addElement(element);
            });
        });

        $('.add-shape').on('click', function () {
            addElement(createDefaultShapeElement());
        });

        dom.deleteElement.on('click', function () {
            if (state.selectedIndex === null) {
                return;
            }

            removeElement(state.selectedIndex);
        });
    }

    function bindPollSettingsEvents() {
        dom.pollSelect.on('change', function () {
            updateSelectedElement('poll', function (element) {
                element.pollId = parseInt(dom.pollSelect.val(), 10) || 0;
            }, { refreshPanel: true });
        });

        dom.pollWidth.on('input', function () {
            updateSelectedElement('poll', function (element) {
                const size = clamp(parseInt(dom.pollWidth.val(), 10) || 100, 55, 100);
                element.size = size;
                element.width = size;
            });
        });
    }

    function bindTextSettingsEvents() {
        dom.fontSize.on('input', function () {
            updateSelectedElement('text', function (element) {
                element.size = parseInt(dom.fontSize.val(), 10) || 24;
            });
        });

        dom.fontFamily.on('change', function () {
            updateSelectedElement('text', function (element) {
                element.fontFamily = dom.fontFamily.val();
            });
        });

        dom.textColor.on('input', function () {
            updateSelectedElement('text', function (element) {
                element.color = dom.textColor.val();
            });
        });

        dom.textPadding.on('input', function () {
            updateSelectedElement('text', function (element) {
                element.padding = parseInt(dom.textPadding.val(), 10) || 0;
            });
        });

        dom.textLineHeight.on('input', function () {
            updateSelectedElement('text', function (element) {
                element.lineHeight = parseFloat(dom.textLineHeight.val()) || 1.2;
            });
        });

        dom.textBackground.on('input', function () {
            setColorFieldValue(dom.textBackground, dom.textBackground.val(), '#000000');
            updateSelectedElement('text', function (element) {
                element.bg = getColorFieldValue(dom.textBackground, 'transparent');
            });
        });

        $('.text-toolbar button').on('click', function () {
            const editor = getEditor();
            if (!editor || state.selectedIndex === null) return;

            const command = $(this).data('cmd');

            editor.focus();

            if (command === 'createLink') {
                const url = prompt('Enter URL');
                if (url) {
                    editor.execCommand('mceInsertLink', false, { href: url });
                }
            } else {
                editor.execCommand(command);
            }

            const element = getSelectedElementOfType('text');
            if (element) {
                element.content = getEditorContent();
                save();
                pushHistorySnapshot();
            }
        });
    }

    function bindButtonSettingsEvents() {
        dom.buttonLabel.on('input', function () {
            updateSelectedElement('button', function (element) {
                element.label = dom.buttonLabel.val() || 'Button';
            });
        });

        dom.buttonUrl.on('input', function () {
            updateSelectedElement('button', function (element) {
                element.url = dom.buttonUrl.val().trim();
            });
        });

        dom.buttonFontSize.on('input', function () {
            updateSelectedElement('button', function (element) {
                element.size = parseInt(dom.buttonFontSize.val(), 10) || 18;
            });
        });

        dom.buttonFontFamily.on('change', function () {
            updateSelectedElement('button', function (element) {
                element.fontFamily = dom.buttonFontFamily.val();
            });
        });

        dom.buttonColor.on('input', function () {
            updateSelectedElement('button', function (element) {
                element.color = dom.buttonColor.val();
            });
        });

        dom.buttonBackground.on('input', function () {
            setColorFieldValue(dom.buttonBackground, dom.buttonBackground.val(), '#000000');
            updateSelectedElement('button', function (element) {
                element.bg = getColorFieldValue(dom.buttonBackground, '#000000');
            });
        });

        dom.buttonBorderColor.on('input', function () {
            updateSelectedElement('button', function (element) {
                element.borderColor = dom.buttonBorderColor.val();
            });
        });

        dom.buttonBorderWidth.on('input', function () {
            updateSelectedElement('button', function (element) {
                element.borderWidth = parseInt(dom.buttonBorderWidth.val(), 10) || 0;
            });
        });

        dom.buttonSize.on('change', function () {
            updateSelectedElement('button', function (element) {
                element.buttonSize = dom.buttonSize.val();
            });
        });
    }

    function bindShapeSettingsEvents() {
        dom.shapeType.on('change', function () {
            updateSelectedElement('shape', function (element) {
                element.shape = dom.shapeType.val();
            }, { refreshPanel: true });
        });

        dom.shapeBackground.on('input', function () {
            setColorFieldValue(dom.shapeBackground, dom.shapeBackground.val(), '#ff0000');
            updateSelectedElement('shape', function (element) {
                element.bg = getColorFieldValue(dom.shapeBackground, '#ff0000');
            });
        });

        dom.shapeBorder.on('input', function () {
            updateSelectedElement('shape', function (element) {
                element.borderColor = dom.shapeBorder.val();
            });
        });

        dom.shapeBorderWidth.on('input', function () {
            updateSelectedElement('shape', function (element) {
                element.borderWidth = parseInt(dom.shapeBorderWidth.val(), 10) || 0;
            });
        });

        $('#shape-width, #shape-height').on('input', function () {
            updateSelectedElement('shape', function (element) {
                element.width = parseInt(dom.shapeWidth.val(), 10) || 100;
                element.height = parseInt(dom.shapeHeight.val(), 10) || 100;
            });
        });

        dom.lineColor.on('input', function () {
            updateSelectedElement('shape', function (element) {
                element.lineColor = dom.lineColor.val();
            });
        });

        dom.lineThickness.on('input', function () {
            updateSelectedElement('shape', function (element) {
                element.lineThickness = parseInt(dom.lineThickness.val(), 10) || 2;
            });
        });
    }

    function bindBuilderTools() {
        dom.gridToggle.on('click', function () {
            state.builder.gridEnabled = !state.builder.gridEnabled;
            updateBuilderToolState();
        });

        dom.snapToggle.on('click', function () {
            state.builder.snapEnabled = !state.builder.snapEnabled;
            updateBuilderToolState();
        });

        dom.undo.on('click', function () {
            undo();
        });

        dom.redo.on('click', function () {
            redo();
        });

        dom.templateSave.on('click', function () {
            saveTemplate();
        });

        dom.templateLoad.on('click', function () {
            applyTemplate(false);
        });

        dom.templateMerge.on('click', function () {
            applyTemplate(true);
        });

        dom.templateDelete.on('click', function () {
            deleteTemplate();
        });

        dom.templateList.on('change', function () {
            updateTemplatePreview();
        });

        updateBuilderToolState();
    }

    function bindLayerPanelEvents() {
        dom.layerList.on('click', '.kosher-layer-item', function (event) {
            if ($(event.target).closest('button').length) {
                return;
            }

            selectElementAndRefresh(parseInt($(this).attr('data-index'), 10));
        });

        dom.layerList.on('click', '.kosher-layer-visibility', function (event) {
            event.preventDefault();
            event.stopPropagation();

            const index = parseInt($(this).closest('.kosher-layer-item').attr('data-index'), 10);
            const element = state.elements[index];
            if (!element) {
                return;
            }

            element.visible = element.visible === false;
            render();
            save();
            pushHistorySnapshot();
        });

        dom.layerList.on('click', '.kosher-layer-delete', function (event) {
            event.preventDefault();
            event.stopPropagation();

            removeElement(parseInt($(this).closest('.kosher-layer-item').attr('data-index'), 10));
        });

        if ($.fn.sortable) {
            dom.layerList.sortable({
                axis: 'y',
                handle: '.kosher-layer-handle',
                update: function () {
                    const ordered = [];
                    const selectedId = getSelectedElementId();
                    dom.layerList.children('.kosher-layer-item').each(function () {
                        const element = state.elements[parseInt($(this).attr('data-index'), 10)];
                        if (element) {
                            ordered.unshift(element);
                        }
                    });

                    state.elements = ordered;
                    normalizeZIndexes();
                    state.selectedIndex = state.selectedIndex === null ? null : state.elements.findIndex(function (element) {
                        return element.id === selectedId;
                    });
                    if (state.selectedIndex < 0) {
                        state.selectedIndex = null;
                    }

                    render();
                    save();
                    pushHistorySnapshot();
                }
            });
        }
    }

    function bindKeyboardShortcuts() {
        $(document).on('keydown.kosherBuilder', function (event) {
            const target = event.target;
            const isEditable = target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable
            );
            const mod = event.metaKey || event.ctrlKey;

            if (!mod) {
                return;
            }

            if (isEditable) {
                return;
            }

            if (event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            }

            if (event.key.toLowerCase() === 'c') {
                if (!isEditable) {
                    event.preventDefault();
                    copySelectedElement();
                }
                return;
            }

            if (event.key.toLowerCase() === 'v') {
                if (!isEditable) {
                    event.preventDefault();
                    pasteElement();
                }
            }
        });
    }

    function bindCanvasEvents() {
        dom.canvas.on('click', function (event) {
            if ($(event.target).closest('.el').length) {
                return;
            }

            clearSelection();
            updateSettingsPanel();
        });
    }

    function bindViewportEvents() {
        $(window).on('resize.kosherBuilder', function () {
            render();
            applyCanvasBackground();
        });
    }

    function bindFormEvents() {
        dom.form.on('submit', function () {
            if (typeof tinymce !== 'undefined') {
                tinymce.triggerSave();
            }

            const element = getSelectedElementOfType('text');
            if (element) {
                element.content = getEditorContent();
            }

            save();
        });
    }

    function bindEditor() {
        if (typeof tinymce === 'undefined') {
            return;
        }

        const editor = getEditor();

        if (!editor) {
            setTimeout(bindEditor, 200);
            return;
        }

        editor.on('keyup change input NodeChange ExecCommand', function () {
            const element = getSelectedElementOfType('text');
            if (!element) {
                return;
            }

            const content = getEditorContent();
            element.content = content;

            const node = dom.canvas.find(`.el[data-index="${state.selectedIndex}"]`);
            if (node.length) {
                node.html(content);
            }

            save();
            queueHistorySnapshot();
        });
    }

    function loadState() {
        const raw = dom.storyData.val();

        if (!raw || raw.trim() === '') {
            applyCanvasBackground();
            return;
        }

        try {
            const parsed = parseStoryData(raw);

            state.elements = Array.isArray(parsed.elements)
                ? parsed.elements.map(normalizeLoadedElement).filter(Boolean)
                : [];

            normalizeZIndexes();
            populateSettings(parsed.settings || {});
            applyCanvasBackground();
        } catch (error) {
            console.error('Failed to load story builder state', error);
            state.elements = [];
            applyCanvasBackground();
        }
    }

    function populateSettings(settings) {
        const duration = clamp(parseInt(settings.duration, 10) || DEFAULT_DURATION, MIN_DURATION, MAX_DURATION);

        dom.durationInput.val(duration);
        syncDurationDisplay(duration);

        setColorFieldValue(dom.backgroundColor, settings.backgroundColor || '#000000', '#000000');
        dom.backgroundImage.val(settings.image || '');
        dom.backgroundVideo.val(settings.video || '');

        if (settings.image) {
            renderImagePreview(settings.image);
        } else {
            dom.backgroundImagePreview.empty();
        }

        if (settings.video) {
            renderVideoPreview(settings.video);
        } else {
            dom.backgroundVideoPreview.empty();
        }
    }

    function render() {
        dom.canvas.find('.el, .kosher-smart-guide, .kosher-spacing-indicator').remove();

        const { width: canvasWidth, height: canvasHeight } = getCanvasSize();

        state.elements.forEach(function (element, index) {
            const node = buildElementNode(element, index, canvasWidth, canvasHeight);

            if (!node) {
                return;
            }

            dom.canvas.append(node);

            if (element.type === 'poll') {
                syncPollNodeLayout(node, element);
            }

            bindNodeEvents(node, element, index, canvasWidth, canvasHeight);
        });

        restoreSelectionVisual();
        renderLayerPanel();
        updateBuilderToolState();
        dom.previewShell.toggleClass('has-poll-preview', state.elements.some(function (element) {
            return element.visible !== false && element.type === 'poll' && !!element.pollId;
        }));
    }

    function buildElementNode(element, index, canvasWidth, canvasHeight) {
        if (element.visible === false) {
            return null;
        }

        let node = null;

        switch (element.type) {
            case 'text':
                node = buildTextNode(element, canvasWidth, canvasHeight);
                break;
            case 'button':
                node = buildButtonNode(element, canvasWidth, canvasHeight);
                break;
            case 'sticker':
                node = buildStickerNode(element, canvasWidth, canvasHeight);
                break;
            case 'poll':
                node = buildPollNode(element, canvasWidth, canvasHeight);
                break;
            case 'shape':
                node = buildShapeNode(element, canvasWidth, canvasHeight);
                break;
        }

        if (node) {
            node.attr({
                'data-index': index,
                'data-element-id': element.id || ''
            });
        }

        return node;
    }

    function bindNodeEvents(node, element, index, canvasWidth, canvasHeight) {
        node.on('click', function (event) {
            event.stopPropagation();
            selectElementAndRefresh(index);
        });

        node.on('mousedown', 'a', function (event) {
            event.preventDefault();
        });

        node.on('click', 'a', function (event) {
            event.preventDefault();
            event.stopPropagation();
        });

        if (element.type === 'text') {
            node.on('blur', function () {
                node.attr('contenteditable', false);
                element.content = node.html();
                save();
            });
        }

        node.draggable({
            containment: dom.canvas,
            start: function () {
                selectElementAndRefresh(index);
            },
            drag: function (event, ui) {
                applyPositionAssists(ui, node, index, canvasWidth, canvasHeight);
                element.x = pixelsToPercentage(ui.position.left, canvasWidth);
                element.y = pixelsToPercentage(ui.position.top, canvasHeight);
            },
            stop: function () {
                clearSmartGuides();
                save();
                pushHistorySnapshot();
            }
        });

        if ((element.type === 'sticker' || element.type === 'shape') && $.fn.resizable) {
            node.resizable({
                containment: dom.canvas,
                handles: 'n, e, s, w, ne, se, sw, nw',
                start: function () {
                    selectElementAndRefresh(index);
                },
                resize: function (event, ui) {
                    applyResizeAssists(ui);
                    element.x = pixelsToPercentage(ui.position.left, canvasWidth);
                    element.y = pixelsToPercentage(ui.position.top, canvasHeight);
                    element.width = Math.max(1, Math.round(ui.size.width));

                    if (element.type === 'sticker') {
                        element.height = Math.max(1, Math.round(ui.size.height));
                    } else if (element.shape === 'line') {
                        element.lineThickness = Math.max(1, Math.round(ui.size.height));
                    } else {
                        element.height = Math.max(1, Math.round(ui.size.height));
                    }
                },
                stop: function () {
                    clearSmartGuides();
                    save();
                    pushHistorySnapshot();
                    updateSettingsPanel();
                }
            });
        }
    }

    function updateSettingsPanel() {
        dom.textSettings.addClass('hidden');
        dom.buttonSettings.addClass('hidden');
        dom.pollSettings.addClass('hidden');
        dom.stickerSettings.addClass('hidden');
        dom.shapeSettings.addClass('hidden');
        dom.lineSettings.addClass('hidden');

        const element = getSelectedElement();
        if (!element) {
            dom.settingsEmpty.removeClass('hidden');
            return;
        }

        dom.settingsEmpty.addClass('hidden');

        if (element.type === 'text') {
            dom.textSettings.removeClass('hidden');
            dom.fontSize.val(element.size || 24);
            dom.fontFamily.val(element.fontFamily || 'Arial');
            dom.textColor.val(element.color || '#ffffff');
            dom.textPadding.val(element.padding ?? 0);
            dom.textLineHeight.val(element.lineHeight ?? 1.2);
            setColorFieldValue(dom.textBackground, element.bg || 'transparent', '#000000');
            setEditorContent(element.content || '');
        }

        if (element.type === 'button') {
            dom.buttonSettings.removeClass('hidden');
            dom.buttonLabel.val(element.label || 'Button');
            dom.buttonUrl.val(element.url || '');
            dom.buttonFontSize.val(element.size || 18);
            dom.buttonFontFamily.val(element.fontFamily || 'Arial');
            dom.buttonColor.val(element.color || '#ffffff');
            setColorFieldValue(dom.buttonBackground, element.bg || '#000000', '#000000');
            dom.buttonBorderColor.val(element.borderColor || '#000000');
            dom.buttonBorderWidth.val(element.borderWidth ?? 1);
            dom.buttonSize.val(element.buttonSize || 'sm');
        }

        if (element.type === 'poll') {
            dom.pollSettings.removeClass('hidden');
            populatePollSelect();
            dom.pollSelect.val(String(element.pollId || ''));
            dom.pollWidth.val(element.size || element.width || 100);
            renderPollStatus(element.pollId || 0);
        }

        if (element.type === 'sticker') {
            dom.stickerSettings.removeClass('hidden');

            const maxSize = Math.min(...Object.values(getCanvasSize()));
            dom.stickerSize.attr('max', maxSize).val(element.width || 120);
        }

        if (element.type === 'shape') {
            const isLine = element.shape === 'line';

            dom.shapeSettings.removeClass('hidden');
            toggleShapeFields(isLine);

            dom.shapeType.val(element.shape || 'square');
            dom.shapeWidth.val(element.width || 100);

            if (isLine) {
                dom.lineSettings.removeClass('hidden');
                dom.lineColor.val(element.lineColor || '#000000');
                dom.lineThickness.val(element.lineThickness || 3);
            } else {
                setColorFieldValue(dom.shapeBackground, element.bg || '#ff0000', '#ff0000');
                dom.shapeBorder.val(element.borderColor || '#000000');
                dom.shapeBorderWidth.val(element.borderWidth || 2);
                dom.shapeHeight.val(element.height || 100);
            }
        }
    }

    function toggleShapeFields(isLine) {
        [
            dom.shapeBackground,
            dom.shapeBorder,
            dom.shapeBorderWidth,
            dom.shapeHeight
        ].forEach(function ($field) {
            $field.toggle(!isLine);
            $field.prev('label').toggle(!isLine);
        });

        dom.lineSettings.toggleClass('hidden', !isLine);
    }

    function save() {
        const existing = parseStoredData();
        const data = {
            elements: serializeElements(),
            settings: {
                ...(existing.settings || {}),
                duration: getDurationValue(),
                backgroundColor: getColorFieldValue(dom.backgroundColor, '#000000'),
                image: dom.backgroundImage.val() || '',
                video: dom.backgroundVideo.val() || ''
            }
        };

        dom.storyData.val(JSON.stringify(data));
    }

    function parseStoredData() {
        const raw = dom.storyData.val();

        if (!raw || raw.trim() === '') {
            return {};
        }

        try {
            return typeof raw === 'object' ? raw : parseStoryData(raw);
        } catch (error) {
            return {};
        }
    }

    function parseStoryData(raw) {
        try {
            return JSON.parse(raw);
        } catch (error) {
            const repaired = repairLegacyStoryJson(raw);

            if (!repaired || repaired === raw) {
                throw error;
            }

            return JSON.parse(repaired);
        }
    }

    function repairLegacyStoryJson(raw) {
        return raw.replace(
            /("content"\s*:\s*")([\s\S]*?)("\s*,\s*"x"\s*:)/g,
            function (match, prefix, content, suffix) {
                return prefix + escapeUnescapedQuotes(content) + suffix;
            }
        );
    }

    function escapeUnescapedQuotes(value) {
        let result = '';

        for (let index = 0; index < value.length; index += 1) {
            const char = value[index];
            const previous = index > 0 ? value[index - 1] : '';

            if (char === '"' && previous !== '\\') {
                result += '\\"';
                continue;
            }

            result += char;
        }

        return result;
    }

    function serializeElements() {
        return state.elements.map(function (element) {
            const serialized = { ...element };
            serialized.id = serialized.id || createElementId();
            serialized.visible = serialized.visible !== false;

            if (serialized.type === 'text') {
                serialized.content = typeof serialized.content === 'string' ? serialized.content : '';
            }

            return serialized;
        });
    }

    function normalizeLoadedElement(element) {
        if (!element || typeof element !== 'object') {
            return null;
        }

        const base = {
            id: element.id || createElementId(),
            visible: element.visible !== false
        };

        if (element.type === 'text') {
            return {
                ...createDefaultTextElement(),
                ...element,
                ...base,
                content: typeof element.content === 'string' ? element.content : '',
                padding: parseInt(element.padding, 10) || 0,
                lineHeight: parseFloat(element.lineHeight) || 1.2
            };
        }

        if (element.type === 'button') {
            return {
                ...createDefaultButtonElement(),
                ...element,
                ...base,
                label: typeof element.label === 'string' && element.label.trim() !== ''
                    ? element.label
                    : 'Button',
                url: typeof element.url === 'string' ? element.url : '',
                buttonSize: getButtonSizeKey(element.buttonSize)
            };
        }

        if (element.type === 'sticker') {
            return {
                ...base,
                type: 'sticker',
                src: element.src || '',
                x: element.x ?? 50,
                y: element.y ?? 50,
                width: element.width ?? 120,
                height: element.height ?? 120,
                z: element.z ?? 1
            };
        }

        if (element.type === 'shape') {
            return {
                ...createDefaultShapeElement(),
                ...element,
                ...base
            };
        }

        if (element.type === 'poll') {
            return {
                ...createDefaultPollElement(),
                ...element,
                ...base,
                pollId: parseInt(element.pollId, 10) || 0,
                size: clamp(parseInt(element.size, 10) || parseInt(element.width, 10) || 100, 55, 100),
                width: clamp(parseInt(element.width, 10) || parseInt(element.size, 10) || 100, 55, 100)
            };
        }

        return null;
    }

    function loadStickers() {
        $.post(kosherBuilder.ajax_url, {
            action: 'kosher_get_stickers'
        }, function (response) {
            if (!response.success) {
                console.error('Sticker AJAX failed', response);
                return;
            }

            const html = response.data
                .map(function (sticker) {
                    return `<img src="${sticker.url}" class="sticker-item">`;
                })
                .join('');

            dom.stickerList.html(html);
        });
    }

    function loadPolls(callback) {
        $.post(kosherBuilder.ajax_url, {
            action: 'kayco_get_story_polls',
            nonce: kosherBuilder.nonce
        }, function (response) {
            if (!response.success) {
                state.polls = [];
                populatePollSelect();
                if (typeof callback === 'function') {
                    callback([]);
                }
                return;
            }

            state.polls = Array.isArray(response.data.polls) ? response.data.polls : [];
            populatePollSelect();
            render();

            if (typeof callback === 'function') {
                callback(state.polls);
            }
        });
    }

    function ensurePollsLoaded(callback) {
        if (state.polls.length) {
            if (typeof callback === 'function') {
                callback(state.polls);
            }
            return;
        }

        loadPolls(callback);
    }

    function populatePollSelect() {
        if (!dom.pollSelect.length) {
            return;
        }

        const options = ['<option value="">Choose a poll</option>']
            .concat(state.polls.map(function (poll) {
                return `<option value="${poll.id}">${escapeHtml(poll.title || 'Untitled Poll')}</option>`;
            }));

        dom.pollSelect.html(options.join(''));
    }

    function getPollById(pollId) {
        pollId = parseInt(pollId, 10) || 0;

        return state.polls.find(function (poll) {
            return poll.id === pollId;
        }) || null;
    }

    function renderPollStatus(pollId) {
        const poll = getPollById(pollId);

        if (!poll) {
            dom.pollStatus.html(`
                <i class="bi bi-bar-chart-line"></i>
                <div>
                    <strong>Select a published poll</strong>
                    <p>Poll slides stay manual so viewers have time to vote.</p>
                </div>
            `);
            return;
        }

        const payload = poll.payload || {};
        const message = payload.hasVoted
            ? 'This preview shows the voted state.'
            : (payload.stateLabel || 'Poll state available on the frontend.');

        dom.pollStatus.html(`
            <i class="bi bi-check2-square"></i>
            <div>
                <strong>${escapeHtml(payload.title || poll.title || 'Poll')}</strong>
                <p>${escapeHtml(message)}</p>
            </div>
        `);
    }

    function openBackgroundVideoFrame() {
        if (state.mediaFrames.video) {
            state.mediaFrames.video.open();
            return;
        }

        state.mediaFrames.video = wp.media({
            title: 'Select Background Video',
            button: { text: 'Use this video' },
            multiple: false,
            library: {
                type: 'video'
            }
        });

        state.mediaFrames.video.on('select', function () {
            const attachment = state.mediaFrames.video.state().get('selection').first().toJSON();
            setBackgroundAsset('video', attachment.url);
        });

        state.mediaFrames.video.open();
    }

    function openBackgroundImageFrame() {
        if (state.mediaFrames.image) {
            state.mediaFrames.image.open();
            return;
        }

        state.mediaFrames.image = wp.media({
            title: 'Select Background Image',
            button: { text: 'Use this image' },
            multiple: false
        });

        state.mediaFrames.image.on('select', function () {
            const attachment = state.mediaFrames.image.state().get('selection').first().toJSON();
            setBackgroundAsset('image', attachment.url);
        });

        state.mediaFrames.image.open();
    }

    function applyCanvasBackground() {
        const image = dom.backgroundImage.val() || '';
        const video = dom.backgroundVideo.val() || '';
        const color = getColorFieldValue(dom.backgroundColor, '#000000');

        dom.canvas.find('.bg-video').remove();
        dom.canvas.find('.story-background--image').remove();
        dom.canvas.css({
            backgroundImage: 'none',
            backgroundColor: ''
        });

        if (video.trim() !== '') {
            dom.canvas.prepend(buildBackgroundVideoElement(video));
            appendFeaturedImageLayer();
            return;
        }

        if (image.trim() !== '') {
            dom.canvas.css({
                backgroundImage: `url(${image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: ''
            });
            appendFeaturedImageLayer();
            return;
        }

        dom.canvas.css({
            backgroundImage: 'none',
            backgroundColor: color
        });

        appendFeaturedImageLayer();
    }

    function buildBackgroundVideoElement(url) {
        return $(`
            <video
                class="bg-video"
                src="${url}"
                autoplay
                muted
                loop
                playsinline
                style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:0;"
            ></video>
        `);
    }

    function setColorFieldValue($input, value, fallback = '#000000') {
        if (!$input || !$input.length) {
            return;
        }

        const isTransparent = value === 'transparent';
        const displayValue = !isTransparent && value ? value : fallback;
        const normalizedValue = isTransparent ? 'transparent' : displayValue;

        $input.val(displayValue);
        $input.attr('data-color-value', normalizedValue);

        const $toggle = $(`.transparent-toggle[data-target="#${$input.attr('id')}"]`);
        $toggle.toggleClass('is-active', isTransparent);
    }

    function getColorFieldValue($input, fallback = '#000000') {
        const storedValue = $input.attr('data-color-value');
        if (storedValue === 'transparent') {
            return 'transparent';
        }

        return $input.val() || storedValue || fallback;
    }

    function applyTransparentColorSelection($input) {
        const inputId = $input.attr('id');

        if (inputId === 'story-background-color') {
            applyCanvasBackground();
            save();
            queueHistorySnapshot();
            return;
        }

        if (inputId === 'bg-color') {
            updateSelectedElement('text', function (element) {
                element.bg = 'transparent';
            });
            return;
        }

        if (inputId === 'button-background') {
            updateSelectedElement('button', function (element) {
                element.bg = 'transparent';
            });
            return;
        }

        if (inputId === 'shape-bg') {
            updateSelectedElement('shape', function (element) {
                element.bg = 'transparent';
            });
        }
    }

    function appendFeaturedImageLayer() {
        const featuredImage = typeof kosherBuilder !== 'undefined' ? kosherBuilder.featuredImage : '';

        if (!featuredImage) {
            return;
        }

        const layer = buildFeaturedImageElement(featuredImage);
        const firstElement = dom.canvas.children('.el').first();

        if (firstElement.length) {
            layer.insertBefore(firstElement);
            return;
        }

        dom.canvas.append(layer);
    }

    function buildFeaturedImageElement(url) {
        return $(`
            <div class="story-background--image">
                <figure>
                    <img src="${url}" alt="">
                </figure>
            </div>
        `);
    }

    function renderVideoPreview(url) {
        dom.backgroundVideoPreview.html(`
            <video src="${url}" style="max-width:100%; margin-top:10px;" muted autoplay loop></video>
        `);
    }

    function renderImagePreview(url) {
        dom.backgroundImagePreview.html(`
            <img src="${url}" style="max-width:100%; margin-top:10px;">
        `);
    }

    function updateRemoveButtons() {
        if (hasBackgroundImage()) {
            dom.removeBackgroundImage.show();
            dom.imagePreviewWrap.show();
        } else {
            dom.removeBackgroundImage.hide();
            dom.imagePreviewWrap.hide();
            dom.backgroundImagePreview.empty();
        }

        if (hasBackgroundVideo()) {
            dom.removeBackgroundVideo.show();
            dom.videoPreviewWrap.show();
        } else {
            dom.removeBackgroundVideo.hide();
            dom.videoPreviewWrap.hide();
            dom.backgroundVideoPreview.empty();
        }
    }

    function hasBackgroundImage() {
        const image = dom.backgroundImage.val();
        return !!(image && image.trim() !== '');
    }

    function hasBackgroundVideo() {
        const video = dom.backgroundVideo.val();
        return !!(video && video.trim() !== '');
    }

    function restoreSelectionVisual() {
        dom.canvas.find('.el').removeClass('selected');
        dom.layerList.find('.kosher-layer-item').removeClass('is-selected');

        if (state.selectedIndex === null) {
            return;
        }

        dom.canvas.find(`.el[data-index="${state.selectedIndex}"]`).addClass('selected');
        dom.layerList.find(`.kosher-layer-item[data-index="${state.selectedIndex}"]`).addClass('is-selected');
    }

    function selectElement(index) {
        state.selectedIndex = index;
        restoreSelectionVisual();
    }

    function selectElementAndRefresh(index) {
        selectElement(index);
        updateSettingsPanel();
    }

    function clearSelection() {
        state.selectedIndex = null;
        restoreSelectionVisual();
    }

    function getSelectedElement() {
        if (state.selectedIndex === null) {
            return null;
        }

        return state.elements[state.selectedIndex] || null;
    }

    function getSelectedElementOfType(type) {
        const element = getSelectedElement();
        return element && element.type === type ? element : null;
    }

    function updateSelectedElement(type, updater, options = {}) {
        const element = getSelectedElementOfType(type);

        if (!element) {
            return false;
        }

        updater(element);

        if (options.render !== false) {
            render();
        }

        if (options.save !== false) {
            save();
            queueHistorySnapshot();
        }

        if (options.refreshPanel) {
            updateSettingsPanel();
        }

        return true;
    }

    function addElement(element) {
        element.id = element.id || createElementId();
        element.visible = element.visible !== false;
        state.elements.push(element);
        normalizeZIndexes();
        selectElementAndRefresh(state.elements.length - 1);
        rerenderAndSave();
        pushHistorySnapshot();
    }

    function removeElement(index) {
        if (Number.isNaN(index) || !state.elements[index]) {
            return;
        }

        state.elements.splice(index, 1);
        normalizeZIndexes();
        clearSelection();
        rerenderAndSave();
        updateSettingsPanel();
        pushHistorySnapshot();
    }

    function rerenderAndSave() {
        render();
        save();
    }

    function getEditor() {
        if (typeof tinymce === 'undefined') {
            return null;
        }

        return tinymce.get('kosher_text_editor');
    }

    function getEditorContent() {
        const editor = getEditor();
        return editor ? editor.getContent({ format: 'raw' }) : '';
    }

    function setEditorContent(content) {
        const editor = getEditor();
        if (editor) {
            editor.setContent(content);
        }
    }

    function getDurationValue() {
        const value = parseInt(dom.durationInput.val(), 10);
        return clamp(isNaN(value) ? DEFAULT_DURATION : value, MIN_DURATION, MAX_DURATION);
    }

    function syncDurationDisplay(duration) {
        dom.durationDisplay.text(formatDurationForDisplay(duration));
    }

    function formatDurationForDisplay(duration) {
        const seconds = duration / 1000;
        return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
    }

    function percentageToPixels(value, total) {
        return (Number(value) / 100) * total;
    }

    function pixelsToPercentage(value, total) {
        if (!total) {
            return 0;
        }

        return (value / total) * 100;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function getCanvasSize() {
        return {
            width: dom.canvas.width(),
            height: dom.canvas.height()
        };
    }

    function setBackgroundAsset(type, url) {
        const config = getBackgroundConfig(type);

        config.input.val(url);
        config.renderPreview(url);
        applyCanvasBackground();
        updateRemoveButtons();
        save();
        pushHistorySnapshot();
    }

    function clearBackgroundAsset(type) {
        const config = getBackgroundConfig(type);

        config.input.val('');
        config.preview.empty();
        applyCanvasBackground();
        updateRemoveButtons();
        save();
        pushHistorySnapshot();
    }

    function getBackgroundConfig(type) {
        if (type === 'video') {
            return {
                input: dom.backgroundVideo,
                preview: dom.backgroundVideoPreview,
                renderPreview: renderVideoPreview
            };
        }

        return {
            input: dom.backgroundImage,
            preview: dom.backgroundImagePreview,
            renderPreview: renderImagePreview
        };
    }

    function buildTextNode(element, canvasWidth, canvasHeight) {
        return $('<div class="el text"></div>')
            .html(typeof element.content === 'string' ? element.content : '<p>Text</p>')
            .css({
                position: 'absolute',
                top: percentageToPixels(element.y, canvasHeight) + 'px',
                left: percentageToPixels(element.x, canvasWidth) + 'px',
                fontSize: (element.size || 24) + 'px',
                fontFamily: element.fontFamily || 'Arial',
                color: element.color,
                background: element.bg,
                padding: (element.padding || 0) + 'px',
                lineHeight: element.lineHeight || 1.2,
                zIndex: element.z,
                textAlign: element.align || 'left',
                minWidth: '50px',
                minHeight: '20px'
            });
    }

    function buildButtonNode(element, canvasWidth, canvasHeight) {
        return $('<div class="el kosher-button"></div>')
            .append(
                $('<a></a>')
                    .addClass(`kosher-btn kosher-btn-${getButtonSizeKey(element.buttonSize)}`)
                    .attr('href', element.url || '#')
                    .attr('target', '_blank')
                    .attr('rel', 'noopener noreferrer')
                    .text(element.label || 'Button')
                    .css({
                        fontSize: (element.size || 18) + 'px',
                        fontFamily: element.fontFamily || 'Arial',
                        color: element.color || '#ffffff',
                        background: element.bg || '#000000',
                        border: `${element.borderWidth || 0}px solid ${element.borderColor || '#000000'}`
                    })
            )
            .css({
                position: 'absolute',
                top: percentageToPixels(element.y, canvasHeight) + 'px',
                left: percentageToPixels(element.x, canvasWidth) + 'px',
                zIndex: element.z
            });
    }

    function buildStickerNode(element, canvasWidth, canvasHeight) {
        return $('<img class="el sticker" />')
            .attr('src', element.src)
            .css({
                position: 'absolute',
                top: percentageToPixels(element.y, canvasHeight) + 'px',
                left: percentageToPixels(element.x, canvasWidth) + 'px',
                width: (element.width || 120) + 'px',
                height: (element.height || 120) + 'px',
                zIndex: element.z
            });
    }

    function buildPollNode(element, canvasWidth, canvasHeight) {
        const poll = getPollById(element.pollId);
        const pollScale = getPollScale(element);

        return $('<div class="el story-poll builder-poll"></div>')
            .append(
                $('<div class="builder-poll__inner"></div>')
                    .html(buildPollPreviewMarkup(poll))
                    .css({
                        transform: `scale(${pollScale})`,
                        transformOrigin: 'top left'
                    })
            )
            .css({
                position: 'absolute',
                top: percentageToPixels(element.y, canvasHeight) + 'px',
                left: percentageToPixels(element.x, canvasWidth) + 'px',
                '--poll-scale': pollScale,
                zIndex: element.z
            });
    }

    function syncPollNodeLayout(node, element) {
        const inner = node.children('.builder-poll__inner');
        const scale = getPollScale(element);

        if (!inner.length) {
            return;
        }

        const baseWidth = inner.outerWidth() || 340;
        const baseHeight = inner.outerHeight() || 360;

        node.css({
            width: Math.max(180, Math.round(baseWidth * scale)) + 'px',
            height: Math.max(120, Math.round(baseHeight * scale)) + 'px'
        });
    }

    function buildShapeNode(element, canvasWidth, canvasHeight) {
        const node = $('<div class="el shape"></div>').css({
            position: 'absolute',
            top: percentageToPixels(element.y, canvasHeight) + 'px',
            left: percentageToPixels(element.x, canvasWidth) + 'px',
            width: (element.width || 100) + 'px',
            height: (element.height || 100) + 'px',
            background: element.bg,
            border: `${element.borderWidth || 0}px solid ${element.borderColor || '#000000'}`,
            zIndex: element.z
        });

        if (element.shape === 'circle') {
            node.css({ borderRadius: '50%' });
        }

        if (element.shape === 'triangle') {
            node.css({
                width: 0,
                height: 0,
                background: 'none',
                borderLeft: `${(element.width || 100) / 2}px solid transparent`,
                borderRight: `${(element.width || 100) / 2}px solid transparent`,
                borderBottom: `${element.height || 100}px solid ${element.bg || '#ff0000'}`,
                borderTop: 'none'
            });
        }

        if (element.shape === 'line') {
            node.css({
                width: (element.width || 100) + 'px',
                height: (element.lineThickness || 3) + 'px',
                background: element.lineColor || '#000000',
                border: 'none'
            });
        }

        return node;
    }

    function buildPollPreviewMarkup(poll) {
        const payload = poll && poll.payload ? poll.payload : null;
        const title = payload && payload.title ? payload.title : ((poll && poll.title) ? poll.title : 'Poll');
        const state = payload && payload.state ? payload.state : 'active';
        const canVote = !!(payload && payload.canVote);
        const hasVoted = !!(payload && payload.hasVoted);
        const description = payload && payload.description ? payload.description : '';
        const totalVotes = payload && typeof payload.totalVotes !== 'undefined' ? payload.totalVotes : 0;
        const startLabel = payload && payload.startLabel ? payload.startLabel : '';
        const endLabel = payload && payload.endLabel ? payload.endLabel : '';
        const contextPost = payload && payload.contextPost ? payload.contextPost : null;
        const message = hasVoted
            ? (canVote ? 'Your vote is saved. Pick another option anytime before the poll closes to update it.' : 'You voted!')
            : (canVote ? 'Please select one' : ((payload && payload.stateLabel) || 'Live now'));
        const options = payload && Array.isArray(payload.options) && payload.options.length
            ? payload.options.slice(0, 3)
            : [
                { id: 'one', label: 'Sample option', description: '', percent: 73, countLabel: '64 votes', isUserVote: true },
                { id: 'two', label: 'Another option', description: '', percent: 21, countLabel: '12 votes', isUserVote: false },
                { id: 'three', label: 'Third option', description: '', percent: 0, countLabel: '0 votes', isUserVote: false }
            ];
        const showVotes = hasVoted || state === 'closed' || totalVotes > 0;
        const emptyState = !canVote
            ? (state === 'scheduled'
                ? `<div class="kayco-poll-card__empty"><p>Voting opens ${escapeHtml(startLabel || 'soon')}.</p></div>`
                : (state === 'closed'
                    ? '<div class="kayco-poll-card__empty"><p>This poll is closed, but the final results are still visible below.</p></div>'
                    : '<div class="kayco-poll-card__empty"><p>Sign in to vote and unlock the live community results.</p><span class="kayco-poll-card__cta">Log In to Vote</span></div>'))
            : '';
        const summaryNote = endLabel
            ? `Closes ${escapeHtml(endLabel)}`
            : (startLabel && state === 'scheduled' ? `Opens ${escapeHtml(startLabel)}` : '');

        return `
            <article class="kayco-poll-card ${hasVoted ? 'has-voted' : ''} ${state !== 'active' ? 'is-inactive' : 'is-active'}" data-poll-id="${(poll && poll.id) || 0}">
                <div class="kayco-poll-card__surface">
                    <div class="kayco-poll-card__header">
                        <div class="kayco-poll-card__intro">
                            <h3 class="kayco-poll-card__title">${escapeHtml(title)}</h3>
                            <p class="kayco-poll-card__notification">${escapeHtml(message)}</p>
                            ${description ? `<p class="kayco-poll-card__description">${escapeHtml(description)}</p>` : ''}
                            ${contextPost && !hasVoted ? `
                                <span class="kayco-poll-card__context-link">
                                    <span>Linked to</span>
                                    <strong>${escapeHtml(contextPost.title || 'Related content')}</strong>
                                </span>
                            ` : ''}
                        </div>
                        <div class="kayco-poll-card__summary">
                            <strong class="kayco-poll-card__summary-value">${escapeHtml(String(totalVotes || 0))}</strong>
                            <span class="kayco-poll-card__summary-label">Total votes</span>
                            ${summaryNote ? `<small class="kayco-poll-card__summary-note">${summaryNote}</small>` : ''}
                        </div>
                    </div>
                    ${emptyState}
                    <div class="kayco-poll-card__form">
                        <div class="kayco-poll-card__options">
                            ${options.map(function (option) {
                                return `
                                    <label class="kayco-poll-option ${option.isUserVote ? 'is-selected' : ''}">
                                        <div class="kayco-poll-option__head">
                                            <div class="kayco-poll-option__copy">
                                                <div class="kayco-poll-option__label-row">
                                                    <span class="kayco-poll-option__icon" aria-hidden="true"></span>
                                                    <strong class="kayco-poll-option__label">${escapeHtml(option.label || 'Option')}</strong>
                                                    <span class="kayco-poll-option__status ${option.isUserVote ? '' : 'is-hidden'}">Your vote</span>
                                                </div>
                                                ${option.description ? `<span class="kayco-poll-option__description">${escapeHtml(option.description)}</span>` : ''}
                                            </div>
                                        </div>
                                        <div class="kayco-poll-option__bar">
                                            <span style="width:${Math.max(0, Math.min(100, parseInt(option.percent, 10) || 0))}%;"></span>
                                        </div>
                                        <div class="kayco-poll-option__meta">
                                            <div class="kayco-poll-option__meta-left">
                                                <span class="kayco-poll-option__vote-label">${escapeHtml(option.countLabel || '0 votes')}</span>
                                            </div>
                                            <span class="kayco-poll-option__percent">${Math.max(0, Math.min(100, parseInt(option.percent, 10) || 0))}%</span>
                                        </div>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                        <div class="kayco-poll-card__footer">
                            ${canVote && !hasVoted ? '<button type="button" class="kayco-poll-card__submit"><span>Submit Vote</span></button>' : ''}
                            ${showVotes ? '<button type="button" class="kayco-poll-card__view-votes"><span>View votes</span><i class="bi bi-chevron-right" aria-hidden="true"></i></button>' : ''}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function createDefaultTextElement() {
        return {
            id: createElementId(),
            type: 'text',
            content: '<p>Edit me</p>',
            x: 50,
            y: 50,
            size: 24,
            color: '#ffffff',
            bg: 'transparent',
            padding: 0,
            lineHeight: 1.2,
            fontFamily: 'Arial',
            z: 1,
            visible: true,
            align: 'left'
        };
    }

    function createDefaultButtonElement() {
        return {
            id: createElementId(),
            type: 'button',
            label: 'Button',
            url: '',
            x: 50,
            y: 50,
            size: 18,
            fontFamily: 'Arial',
            color: '#ffffff',
            bg: '#000000',
            borderColor: '#000000',
            borderWidth: 1,
            buttonSize: 'sm',
            visible: true,
            z: 1
        };
    }

    function createDefaultShapeElement() {
        return {
            id: createElementId(),
            type: 'shape',
            shape: 'square',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            bg: '#ff0000',
            borderColor: '#000000',
            borderWidth: 2,
            lineColor: '#000000',
            lineThickness: 3,
            visible: true,
            z: 1
        };
    }

    function createDefaultPollElement() {
        return {
            id: createElementId(),
            type: 'poll',
            pollId: 0,
            x: 8,
            y: 14,
            size: 100,
            width: 100,
            visible: true,
            z: 1
        };
    }

    function createElementId() {
        return 'el_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function getPollScale(element) {
        return clamp((parseFloat(element.size || element.width || 100) || 100) / 100, 0.55, 1);
    }

    function normalizeZIndexes() {
        state.elements.forEach(function (element, index) {
            element.id = element.id || createElementId();
            element.visible = element.visible !== false;
            element.z = index + 1;
        });
    }

    function getSelectedElementId() {
        const element = getSelectedElement();
        return element ? element.id : '';
    }

    function updateBuilderToolState() {
        dom.canvas.toggleClass('grid-enabled', state.builder.gridEnabled);
        dom.gridToggle.toggleClass('is-active', state.builder.gridEnabled).attr('aria-pressed', state.builder.gridEnabled ? 'true' : 'false');
        dom.snapToggle.toggleClass('is-active', state.builder.snapEnabled).attr('aria-pressed', state.builder.snapEnabled ? 'true' : 'false');
        dom.undo.prop('disabled', state.history.undoStack.length <= 1);
        dom.redo.prop('disabled', state.history.redoStack.length === 0);
    }

    function renderLayerPanel() {
        if (!dom.layerList.length) {
            return;
        }

        if (!state.elements.length) {
            dom.layerList.html(`
                <div class="kosher-layer-empty">
                    <i class="bi bi-layers"></i>
                    <span>No layers yet</span>
                </div>
            `);
            return;
        }

        const html = state.elements
            .map(function (element, index) {
                return { element, index };
            })
            .reverse()
            .map(function (item) {
                const element = item.element;
                const index = item.index;
                const isVisible = element.visible !== false;

                return `
                    <div class="kosher-layer-item ${index === state.selectedIndex ? 'is-selected' : ''} ${!isVisible ? 'is-hidden-layer' : ''}" data-index="${index}">
                        <span class="kosher-layer-handle"><i class="bi bi-grip-vertical"></i></span>
                        <span class="kosher-layer-icon"><i class="bi ${getLayerIcon(element)}"></i></span>
                        <span class="kosher-layer-title">${escapeHtml(getLayerTitle(element, index))}</span>
                        <button type="button" class="kosher-layer-visibility" title="${isVisible ? 'Hide layer' : 'Show layer'}">
                            <i class="bi ${isVisible ? 'bi-eye' : 'bi-eye-slash'}"></i>
                        </button>
                        <button type="button" class="kosher-layer-delete" title="Delete layer">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                `;
            })
            .join('');

        dom.layerList.html(html);
    }

    function getLayerIcon(element) {
        if (element.type === 'text') return 'bi-type';
        if (element.type === 'button') return 'bi-link-45deg';
        if (element.type === 'poll') return 'bi-bar-chart-line';
        if (element.type === 'sticker') return 'bi-emoji-smile';
        return element.shape === 'line' ? 'bi-slash-lg' : 'bi-bounding-box';
    }

    function getLayerTitle(element, index) {
        if (element.type === 'text') {
            return stripHtml(element.content || 'Text').slice(0, 28) || `Text ${index + 1}`;
        }

        if (element.type === 'button') {
            return element.label || `Button ${index + 1}`;
        }

        if (element.type === 'poll') {
            const poll = getPollById(element.pollId);
            return (poll && poll.title) || `Poll ${index + 1}`;
        }

        if (element.type === 'sticker') {
            return `Sticker ${index + 1}`;
        }

        return `${capitalize(element.shape || 'Shape')} ${index + 1}`;
    }

    function stripHtml(value) {
        return String(value).replace(/<[^>]*>/g, '').trim();
    }

    function capitalize(value) {
        const text = String(value || '');
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function queueHistorySnapshot() {
        if (state.history.isRestoring) {
            return;
        }

        clearTimeout(state.history.debounceTimer);
        state.history.debounceTimer = setTimeout(pushHistorySnapshot, 300);
    }

    function pushHistorySnapshot() {
        if (state.history.isRestoring) {
            return;
        }

        clearTimeout(state.history.debounceTimer);

        const snapshot = createHistorySnapshot();
        const last = state.history.undoStack[state.history.undoStack.length - 1];

        if (snapshot === last) {
            updateBuilderToolState();
            return;
        }

        state.history.undoStack.push(snapshot);

        if (state.history.undoStack.length > HISTORY_LIMIT) {
            state.history.undoStack.shift();
        }

        state.history.redoStack = [];
        updateBuilderToolState();
        debugLog('History snapshot saved', state.history.undoStack.length);
    }

    function createHistorySnapshot() {
        return JSON.stringify({
            elements: serializeElements(),
            settings: {
                duration: getDurationValue(),
                backgroundColor: getColorFieldValue(dom.backgroundColor, '#000000'),
                image: dom.backgroundImage.val() || '',
                video: dom.backgroundVideo.val() || ''
            }
        });
    }

    function restoreHistorySnapshot(snapshot) {
        state.history.isRestoring = true;

        try {
            const parsed = JSON.parse(snapshot);
            state.elements = Array.isArray(parsed.elements)
                ? parsed.elements.map(normalizeLoadedElement).filter(Boolean)
                : [];
            normalizeZIndexes();
            populateSettings(parsed.settings || {});
            applyCanvasBackground();
            clearSelection();
            render();
            save();
            updateSettingsPanel();
        } finally {
            state.history.isRestoring = false;
            updateBuilderToolState();
        }
    }

    function undo() {
        if (state.history.undoStack.length <= 1) {
            return;
        }

        const current = state.history.undoStack.pop();
        state.history.redoStack.push(current);
        restoreHistorySnapshot(state.history.undoStack[state.history.undoStack.length - 1]);
    }

    function redo() {
        const snapshot = state.history.redoStack.pop();
        if (!snapshot) {
            return;
        }

        state.history.undoStack.push(snapshot);
        restoreHistorySnapshot(snapshot);
    }

    function copySelectedElement() {
        const element = getSelectedElement();
        if (!element) {
            return;
        }

        localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(element));
    }

    function pasteElement() {
        const raw = localStorage.getItem(CLIPBOARD_KEY);
        if (!raw) {
            return;
        }

        try {
            const element = normalizeLoadedElement(JSON.parse(raw));
            if (!element) {
                return;
            }

            element.id = createElementId();
            element.x = clamp((parseFloat(element.x) || 0) + 4, 0, 96);
            element.y = clamp((parseFloat(element.y) || 0) + 4, 0, 96);
            addElement(element);
        } catch (error) {
            debugLog('Paste failed', error);
        }
    }

    function loadTemplates() {
        $.post(kosherBuilder.ajax_url, {
            action: 'kayco_get_story_templates',
            nonce: kosherBuilder.nonce
        }, function (response) {
            if (!response.success) {
                return;
            }

            state.templates = Array.isArray(response.data.templates) ? response.data.templates : [];
            renderTemplateOptions();
        });
    }

    function renderTemplateOptions() {
        const options = ['<option value="">Select saved template</option>']
            .concat(state.templates.map(function (template) {
                return `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`;
            }));

        dom.templateList.html(options.join(''));
        updateTemplatePreview();
    }

    function saveTemplate() {
        const name = (dom.templateName.val() || '').trim() || prompt('Template name');
        if (!name) {
            return;
        }

        save();

        $.post(kosherBuilder.ajax_url, {
            action: 'kayco_save_story_template',
            nonce: kosherBuilder.nonce,
            name,
            thumbnail: getTemplateThumbnail(),
            json: dom.storyData.val()
        }, function (response) {
            if (!response.success) {
                alert('Template could not be saved.');
                return;
            }

            dom.templateName.val('');
            loadTemplates();
        });
    }

    function applyTemplate(merge) {
        const template = getSelectedTemplate();
        if (!template) {
            return;
        }

        try {
            const parsed = parseStoryData(template.json);
            const elements = Array.isArray(parsed.elements)
                ? parsed.elements.map(normalizeLoadedElement).filter(Boolean)
                : [];

            elements.forEach(function (element) {
                element.id = createElementId();
            });

            state.elements = merge ? state.elements.concat(elements) : elements;
            normalizeZIndexes();

            if (!merge) {
                populateSettings(parsed.settings || {});
                applyCanvasBackground();
            }

            clearSelection();
            rerenderAndSave();
            pushHistorySnapshot();
        } catch (error) {
            alert('Template could not be loaded.');
            debugLog('Template load failed', error);
        }
    }

    function deleteTemplate() {
        const template = getSelectedTemplate();
        if (!template || !confirm('Delete this template?')) {
            return;
        }

        $.post(kosherBuilder.ajax_url, {
            action: 'kayco_delete_story_template',
            nonce: kosherBuilder.nonce,
            template_id: template.id
        }, function (response) {
            if (!response.success) {
                alert('Template could not be deleted.');
                return;
            }

            loadTemplates();
        });
    }

    function getSelectedTemplate() {
        const id = dom.templateList.val();
        return state.templates.find(function (template) {
            return template.id === id;
        });
    }

    function updateTemplatePreview() {
        const template = getSelectedTemplate();

        if (!template) {
            dom.templatePreview.html('<i class="bi bi-image"></i><span>No template selected</span>');
            return;
        }

        if (template.thumbnail) {
            dom.templatePreview.html(`<img src="${escapeHtml(template.thumbnail)}" alt=""><span>${escapeHtml(template.name)}</span>`);
            return;
        }

        dom.templatePreview.html(`<i class="bi bi-window-stack"></i><span>${escapeHtml(template.name)}</span>`);
    }

    function getTemplateThumbnail() {
        return dom.backgroundImage.val() || (typeof kosherBuilder !== 'undefined' ? kosherBuilder.featuredImage : '') || '';
    }

    function applyPositionAssists(ui, node, index, canvasWidth, canvasHeight) {
        if (state.builder.gridEnabled && state.builder.snapEnabled) {
            ui.position.left = snapToGrid(ui.position.left);
            ui.position.top = snapToGrid(ui.position.top);
        }

        applySmartGuides(ui, node, index, canvasWidth, canvasHeight);
    }

    function applyResizeAssists(ui) {
        if (!state.builder.gridEnabled || !state.builder.snapEnabled) {
            return;
        }

        ui.size.width = Math.max(1, snapToGrid(ui.size.width));
        ui.size.height = Math.max(1, snapToGrid(ui.size.height));
    }

    function snapToGrid(value) {
        const gridSize = state.builder.gridSize;
        return Math.round(value / gridSize) * gridSize;
    }

    function applySmartGuides(ui, node, index, canvasWidth, canvasHeight) {
        const threshold = 6;
        const guides = [];
        const nodeWidth = node.outerWidth();
        const nodeHeight = node.outerHeight();
        const current = {
            left: ui.position.left,
            right: ui.position.left + nodeWidth,
            top: ui.position.top,
            bottom: ui.position.top + nodeHeight,
            centerX: ui.position.left + nodeWidth / 2,
            centerY: ui.position.top + nodeHeight / 2
        };

        const canvasCenterX = canvasWidth / 2;
        const canvasCenterY = canvasHeight / 2;

        if (Math.abs(current.centerX - canvasCenterX) <= threshold) {
            ui.position.left = canvasCenterX - nodeWidth / 2;
            guides.push({ type: 'vertical', position: canvasCenterX });
        }

        if (Math.abs(current.centerY - canvasCenterY) <= threshold) {
            ui.position.top = canvasCenterY - nodeHeight / 2;
            guides.push({ type: 'horizontal', position: canvasCenterY });
        }

        state.elements.forEach(function (element, otherIndex) {
            if (otherIndex === index || element.visible === false) {
                return;
            }

            const other = getElementBox(element, canvasWidth, canvasHeight);
            const alignments = [
                ['left', other.left, 0, 'vertical'],
                ['centerX', other.centerX, nodeWidth / 2, 'vertical'],
                ['right', other.right, nodeWidth, 'vertical'],
                ['top', other.top, 0, 'horizontal'],
                ['centerY', other.centerY, nodeHeight / 2, 'horizontal'],
                ['bottom', other.bottom, nodeHeight, 'horizontal']
            ];

            alignments.forEach(function ([key, target, offset, type]) {
                if (Math.abs(current[key] - target) > threshold) {
                    return;
                }

                if (type === 'vertical') {
                    ui.position.left = target - offset;
                } else {
                    ui.position.top = target - offset;
                }

                guides.push({ type, position: target });
            });
        });

        renderSmartGuides(guides);
        renderSpacingIndicator(ui, node, index, canvasWidth, canvasHeight);
    }

    function getElementBox(element, canvasWidth, canvasHeight) {
        const width = getElementPixelWidth(element);
        const height = getElementPixelHeight(element);
        const left = percentageToPixels(element.x, canvasWidth);
        const top = percentageToPixels(element.y, canvasHeight);

        return {
            left,
            top,
            right: left + width,
            bottom: top + height,
            centerX: left + width / 2,
            centerY: top + height / 2,
            width,
            height
        };
    }

    function getElementPixelWidth(element) {
        if (element.type === 'sticker' || element.type === 'shape') {
            return parseFloat(element.width) || 100;
        }

        if (element.type === 'poll') {
            const node = dom.canvas.find(`.el[data-element-id="${element.id}"]`);
            return node.length ? node.outerWidth() : (340 * getPollScale(element));
        }

        const node = dom.canvas.find(`.el[data-element-id="${element.id}"]`);
        return node.length ? node.outerWidth() : 80;
    }

    function getElementPixelHeight(element) {
        if (element.type === 'sticker') {
            return parseFloat(element.height) || 120;
        }

        if (element.type === 'shape') {
            return element.shape === 'line'
                ? (parseFloat(element.lineThickness) || 3)
                : (parseFloat(element.height) || 100);
        }

        if (element.type === 'poll') {
            const node = dom.canvas.find(`.el[data-element-id="${element.id}"]`);
            return node.length ? node.outerHeight() : (300 * getPollScale(element));
        }

        const node = dom.canvas.find(`.el[data-element-id="${element.id}"]`);
        return node.length ? node.outerHeight() : 32;
    }

    function renderSmartGuides(guides) {
        dom.canvas.find('.kosher-smart-guide').remove();

        guides.slice(0, 6).forEach(function (guide) {
            const node = $('<span class="kosher-smart-guide"></span>');
            if (guide.type === 'vertical') {
                node.addClass('is-vertical').css('left', guide.position + 'px');
            } else {
                node.addClass('is-horizontal').css('top', guide.position + 'px');
            }
            dom.canvas.append(node);
        });
    }

    function renderSpacingIndicator(ui, node, index, canvasWidth, canvasHeight) {
        dom.canvas.find('.kosher-spacing-indicator').remove();

        let closest = null;
        const nodeWidth = node.outerWidth();
        const nodeHeight = node.outerHeight();
        const box = {
            left: ui.position.left,
            right: ui.position.left + nodeWidth,
            top: ui.position.top,
            bottom: ui.position.top + nodeHeight
        };

        state.elements.forEach(function (element, otherIndex) {
            if (otherIndex === index || element.visible === false) {
                return;
            }

            const other = getElementBox(element, canvasWidth, canvasHeight);
            const sameRow = Math.abs((box.top + nodeHeight / 2) - other.centerY) < Math.max(nodeHeight, other.height);
            const sameColumn = Math.abs((box.left + nodeWidth / 2) - other.centerX) < Math.max(nodeWidth, other.width);
            const horizontalGap = sameRow ? Math.min(Math.abs(box.left - other.right), Math.abs(other.left - box.right)) : Infinity;
            const verticalGap = sameColumn ? Math.min(Math.abs(box.top - other.bottom), Math.abs(other.top - box.bottom)) : Infinity;
            const gap = Math.min(horizontalGap, verticalGap);

            if (gap > 0 && gap < 90 && (!closest || gap < closest.gap)) {
                closest = { gap: Math.round(gap), x: box.left + nodeWidth / 2, y: box.top - 12 };
            }
        });

        if (!closest) {
            return;
        }

        dom.canvas.append(
            $('<span class="kosher-spacing-indicator"></span>')
                .text(closest.gap + 'px')
                .css({
                    left: closest.x + 'px',
                    top: Math.max(8, closest.y) + 'px'
                })
        );
    }

    function clearSmartGuides() {
        dom.canvas.find('.kosher-smart-guide, .kosher-spacing-indicator').remove();
    }

    function debugLog() {
        if (localStorage.getItem(DEBUG_KEY) !== '1') {
            return;
        }

        console.log.apply(console, ['[Kosher Builder]'].concat(Array.from(arguments)));
    }

    function getButtonSizeKey(sizeKey) {
        return BUTTON_SIZE_KEYS.includes(sizeKey) ? sizeKey : 'sm';
    }
});
