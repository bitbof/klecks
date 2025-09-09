import { showModal } from './ui/modals/base/showModal';
import { DynamicModal } from './ui/modals/base/dynamic-modal';
import { DIALOG_COUNTER } from './ui/modals/modal-count';
import { Checkbox } from './ui/components/checkbox';
import { input } from './ui/components/input';
import { Select } from './ui/components/select';
import { ImageToggle } from './ui/components/image-toggle';
import { ImageRadioList } from './ui/components/image-radio-list';
import { createPenPressureToggle } from './ui/components/create-pen-pressure-toggle';
import { KlSlider } from './ui/components/kl-slider';
import { HexColorDialog } from './ui/modals/color-slider-hex-dialog';
import { KlColorSlider } from './ui/components/kl-color-slider';
import { KlColorSliderSmall } from './ui/components/kl-color-slider-small';
import { PointSlider } from './ui/components/point-slider';
import { ColorOptions } from './ui/components/color-options';
import { Options } from './ui/components/options';
import { StatusOverlay } from './ui/components/status-overlay';
import { CropCopy } from './ui/components/crop-copy';
import { clipboardDialog } from './ui/modals/clipboard-dialog';
import { LayersUi } from './ui/tool-tabs/layers-ui/layers-ui';
import { KlCanvasPreview } from './ui/project-viewport/kl-canvas-preview';
import { FreeTransform } from './ui/components/free-transform';
import { FreeTransformCanvas } from './ui/components/free-transform-canvas';
import { Cropper } from './ui/components/cropper';
import { LayerPreview } from './ui/components/layer-preview';
import { showImportAsLayerDialog } from './ui/modals/show-import-as-layer-dialog';
import { KlImageDropper } from './ui/components/kl-image-dropper';
import { OverlayToolspace } from './ui/components/overlay-toolspace';
import { ToolspaceTopRow } from './ui/components/toolspace-top-row';
import { ToolDropdown } from './ui/components/tool-dropdown';
import { ToolspaceToolRow } from './ui/components/toolspace-tool-row';
import { ToolspaceStabilizerRow } from './ui/components/toolspace-stabilizer-row';
import { TabRow } from './ui/components/tab-row';
import { HandUi } from './ui/tool-tabs/hand-ui';
import { FillUi } from './ui/tool-tabs/fill-ui';
import { TextUi } from './ui/tool-tabs/text-ui';
import { ShapeUi } from './ui/tool-tabs/shape-ui';
import { newImageDialog } from './ui/modals/new-image-dialog';
import { ToolspaceCollapser } from './ui/mobile/toolspace-collapser';
import { textToolDialog } from './ui/modals/text-tool-dialog/text-tool-dialog';
import { showImportImageDialog } from './ui/modals/show-import-image-dialog';
import * as PSD from './storage/psd';
import { drawShape, ShapeTool } from './image-operations/shape-tool';
import { KlCanvas } from './canvas/kl-canvas';
import { FILTER_LIB, FILTER_LIB_STATUS } from './filters/filters';
import { BRUSHES } from './brushes/brushes';
import { BRUSHES_UI } from './brushes-ui/brushes-ui';
import { showIframeModal } from './ui/modals/show-iframe-modal';
import { RadioList } from './ui/components/radio-list';
import { BrowserStorageUi } from './ui/components/browser-storage-ui';
import { ProjectStore } from './storage/project-store';
import { FileUi } from './ui/tool-tabs/file-ui';
import { EditUi } from './ui/tool-tabs/edit-ui';
import { imgurUpload } from './ui/modals/imgur-upload';
import { loadAgPsd } from './storage/load-ag-psd';
import { SaveReminder } from './ui/components/save-reminder';
import { SaveToComputer } from './storage/save-to-computer';
import { BrushSettingService } from './brushes-ui/brush-setting-service';
import { BoxToggle } from './ui/components/box-toggle';
import { SettingsUi } from './ui/tool-tabs/settings-ui';
import { ToolspaceScroller } from './ui/components/toolspace-scroller';
import { GradientUi } from './ui/tool-tabs/gradient-ui';
import { drawGradient, GradientTool } from './image-operations/gradient-tool';

/**
 * paint tool functionality
 */
export const KL = {
    // --- brushes ---
    BRUSHES,
    BRUSHES_UI,
    BrushSettingService,

    // --- canvas ---
    KlCanvas,

    // --- canvas ui ---
    KlCanvasPreview,

    // --- filters ---
    FILTER_LIB_STATUS,
    FILTER_LIB,

    // --- image operations ---
    ShapeTool,
    drawShape,
    GradientTool,
    drawGradient,

    // --- storage ---
    PSD,
    ProjectStore,
    loadAgPsd,
    SaveToComputer,

    // --- ui - components ---
    Checkbox,
    input,
    Select,
    ImageToggle,
    ImageRadioList,
    RadioList,
    createPenPressureToggle,
    KlSlider,
    HexColorDialog,
    KlColorSlider,
    KlColorSliderSmall,
    PointSlider,
    ColorOptions,
    Options,
    BoxToggle,
    StatusOverlay,
    CropCopy,
    FreeTransform,
    FreeTransformCanvas,
    Cropper,
    LayerPreview,
    KlImageDropper,
    OverlayToolspace,
    ToolspaceTopRow,
    ToolDropdown,
    ToolspaceToolRow,
    ToolspaceStabilizerRow,
    TabRow,
    ToolspaceCollapser,
    BrowserStorageUi,
    SaveReminder,
    ToolspaceScroller,

    // --- ui - modals ---
    DIALOG_COUNTER,
    popup: showModal,
    Popup: DynamicModal,
    clipboardDialog,
    showImportAsLayerDialog,
    newImageDialog,
    textToolDialog,
    showImportImageDialog,
    showIframePopup: showIframeModal,
    imgurUpload,

    // --- ui - tool tabs ---
    HandUi,
    FillUi,
    GradientUi,
    TextUi,
    ShapeUi,
    FileUi,
    EditUi,
    SettingsUi,
    LayersUi,
};

Object.keys(KL); // without this, parcel build may break this object
