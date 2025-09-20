import { c } from '../../../bb/base/c';
import { ProjectViewport, TProjectViewportProject, TViewportTransform } from './project-viewport';
import { BB } from '../../../bb/bb';
import { PointerListener } from '../../../bb/input/pointer-listener';
import toolZoomInImg from 'url:/src/app/img/ui/tool-zoom-in.svg';
import toolZoomOutImg from 'url:/src/app/img/ui/tool-zoom-out.svg';
import viewportResetImg from 'url:/src/app/img/ui/viewport-reset.svg';
import toolHandImg from 'url:/src/app/img/ui/tool-hand.svg';
import editPencilImg from 'url:/src/app/img/ui/edit-pencil.svg';
import { EventChain } from '../../../bb/input/event-chain/event-chain';
import { DoubleTapper } from '../../../bb/input/event-chain/double-tapper';
import { TChainElement } from '../../../bb/input/event-chain/event-chain.types';
import * as classes from './preview.module.scss';
import { zoomByStep } from './utils/zoom-by-step';
import { PinchZoomer } from '../../../bb/input/event-chain/pinch-zoomer';
import { LANG } from '../../../language/language';
import { applyToPoint, inverse } from 'transformation-matrix';
import { createTransform } from '../../../bb/transform/create-transform';
import { toMetaTransform } from '../../../bb/transform/to-meta-transform';
import { Options } from '../components/options';
import { TPointerEvent, TWheelEvent } from '../../../bb/input/event.types';
import { createMatrixFromTransform } from '../../../bb/transform/create-matrix-from-transform';
import { MultiPolygon } from 'polygon-clipping';
import { SelectionRenderer } from '../easel/selection-renderer';
import { css } from '../../../bb/base/base';

export type TPreviewMode = 'edit' | 'hand';

export type TPreviewParams = {
    width: number;
    height: number;
    project: TProjectViewportProject;
    onTransformChange?: (transform: TViewportTransform) => void;
    hasEditMode?: boolean; // default false
    onModeChange?: (mode: TPreviewMode) => void;
    padding?: number; //default -> DEFAULT_PADDING
    hasBorder?: boolean; // default true
    editIcon?: string;
    selection?: MultiPolygon;
};

const DEFAULT_PADDING = 10;

export class Preview {
    private readonly rootEl: HTMLElement;
    private readonly project: TProjectViewportProject;
    private viewport: ProjectViewport;
    private readonly width: number;
    private readonly height: number;
    private isReset: boolean = true;
    private readonly viewportPointerListener: PointerListener;
    private doRender = false;
    private readonly padding: number;
    private animationFrameId: ReturnType<typeof requestAnimationFrame> | undefined;
    private readonly onTransformChange: TPreviewParams['onTransformChange'] | undefined;
    private lastEmittedTransform: TViewportTransform = {
        x: 0,
        y: 0,
        scale: 0,
        angleDeg: 0,
    };
    private readonly modeToggle: Options<TPreviewMode> | undefined;
    private readonly pointerChain: EventChain;
    private selectionRenderer: SelectionRenderer | undefined;

    private renderLoop = (): void => {
        this.animationFrameId = requestAnimationFrame(this.renderLoop);

        if (this.doRender) {
            this.doRender = false;
            this.viewport.render();
            const viewportTransform = this.viewport.getTransform();
            this.selectionRenderer?.setTransform(viewportTransform);
            if (
                this.onTransformChange &&
                JSON.stringify(this.lastEmittedTransform) !== JSON.stringify(viewportTransform)
            ) {
                this.onTransformChange(viewportTransform);
                this.lastEmittedTransform = viewportTransform;
            }
        }
    };

    private requestRerender(): void {
        this.doRender = true;
    }

    private resetOrZoom(x: number, y: number): void {
        if (this.isReset) {
            this.isReset = false;

            const canvasP = applyToPoint(
                inverse(createMatrixFromTransform(this.viewport.getTransform())),
                { x, y },
            );

            this.viewport.setTransform(
                createTransform({ x: this.width / 2, y: this.height / 2 }, canvasP, 1, 0),
            );
            this.requestRerender();
        } else {
            this.reset();
        }
    }

    private reset(): void {
        const fit = BB.fitInto(
            this.project.width,
            this.project.height,
            this.width - this.padding * 2,
            this.height - this.padding * 2,
        );
        const scale = fit.width / this.project.width;
        this.viewport.setTransform(
            createTransform(
                { x: this.width / 2, y: this.height / 2 },
                { x: this.project.width / 2, y: this.project.height / 2 },
                scale,
                0,
            ),
        );
        this.isReset = true;
        this.requestRerender();
    }

    private transformCanvas(
        t:
            | {
                  type: 'translate';
                  x: number;
                  y: number;
              }
            | {
                  type: 'rotate';
                  cX: number;
                  cY: number;
                  angleDeg: number;
              }
            | {
                  type: 'zoom';
                  vX?: number;
                  vY?: number;
                  fac: number;
              },
    ): void {
        if (t.type === 'translate') {
            const old = this.viewport.getTransform();
            if (t.x === 0 && t.y === 0) {
                return;
            }
            this.viewport.setTransform({
                ...old,
                x: old.x + t.x,
                y: old.y + t.y,
            });
        } else if (t.type === 'zoom') {
            const old = this.viewport.getTransform();
            const viewportRect = this.viewport.getElement().getBoundingClientRect();
            t.vX = t.vX ?? viewportRect.width / 2;
            t.vY = t.vY ?? viewportRect.height / 2;

            const metaTransform = toMetaTransform(old, { x: t.vX, y: t.vY });
            metaTransform.scale *= t.fac;

            this.viewport.setTransform(
                createTransform(
                    metaTransform.viewportP,
                    metaTransform.canvasP,
                    metaTransform.scale,
                    metaTransform.angleDeg,
                ),
            );
        }
        this.isReset = false;

        this.requestRerender();
    }

    // ----------------------------------- public -----------------------------------
    constructor(p: TPreviewParams) {
        this.width = p.width;
        this.height = p.height;
        this.project = p.project;
        this.onTransformChange = p.onTransformChange;
        this.padding = p.padding ?? DEFAULT_PADDING;

        const fit = BB.fitInto(
            this.project.width,
            this.project.height,
            this.width - this.padding * 2,
            this.height - this.padding * 2,
        );
        const scale = fit.width / this.project.width;

        this.viewport = new ProjectViewport({
            width: this.width,
            height: this.height,
            transform: createTransform(
                { x: this.width / 2, y: this.height / 2 },
                { x: this.project.width / 2, y: this.project.height / 2 },
                scale,
                0,
            ),
            project: this.project,
            useNativeResolution: false,
            drawBackground: true,
        });

        const doubleTapper = new DoubleTapper({
            onDoubleTap: (e) => {
                const m = createMatrixFromTransform(this.viewport.getTransform());
                const tl = applyToPoint(m, { x: 0, y: 0 });
                const br = applyToPoint(m, { x: this.project.width, y: this.project.height });
                const isInside = BB.isInsideRect(
                    { x: e.relX, y: e.relY },
                    {
                        x: tl.x,
                        y: tl.y,
                        width: br.x - tl.x,
                        height: br.y - tl.y,
                    },
                );

                if (!this.isReset || isInside) {
                    this.resetOrZoom(e.relX, e.relY);
                }
            },
            isInstant: true,
        });
        let oldTransform: TViewportTransform | undefined = undefined;
        const pinchZoomer = new PinchZoomer({
            onPinch: (e) => {
                if (e.type === 'move') {
                    if (!oldTransform) {
                        oldTransform = this.viewport.getTransform();
                    }
                    const metaTransform = toMetaTransform(oldTransform, {
                        x: e.downRelX,
                        y: e.downRelY,
                    });
                    metaTransform.scale *= e.scale;
                    metaTransform.viewportP.x += e.relX - e.downRelX;
                    metaTransform.viewportP.y += e.relY - e.downRelY;
                    this.viewport.setTransform(
                        createTransform(
                            metaTransform.viewportP,
                            metaTransform.canvasP,
                            metaTransform.scale,
                            metaTransform.angleDeg,
                        ),
                    );
                    this.requestRerender();
                    this.isReset = false;
                } else if (e.type === 'end') {
                    oldTransform = undefined;
                }
            },
        });

        this.pointerChain = new EventChain({
            chainArr: [pinchZoomer as TChainElement, doubleTapper as TChainElement],
        });
        this.pointerChain.setChainOut((e) => {
            if (e.button && ['left', 'middle'].includes(e.button)) {
                // debugOut(JSON.stringify(e));
                this.transformCanvas({
                    type: 'translate',
                    x: e.dX,
                    y: e.dY,
                });
            }
        });

        this.viewport.getElement().classList.add(classes.viewport);
        css(this.viewport.getElement(), {
            userSelect: 'none',
            touchAction: 'none',
        });
        this.viewport.getElement().addEventListener('touchend', (e) => {
            e.preventDefault();
            return false;
        });
        this.viewport.getElement().addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        this.viewport.getElement().addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });

        this.viewportPointerListener = new PointerListener({
            target: this.viewport.getElement(),
            onPointer: (e) => {
                this.pointerChain.chainIn(e);
            },
            onWheel: this.onWheel,
            maxPointers: 2,
        });
        this.viewport.getElement().addEventListener('wheel', (e) => {
            e.preventDefault();
        });

        const svgRoot = BB.createSvg({
            elementType: 'svg',
        });
        css(svgRoot, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
        });
        if (p.selection) {
            this.selectionRenderer = new SelectionRenderer({
                transform: this.lastEmittedTransform,
                selection: p.selection,
                width: this.width,
                height: this.height,
            });
            svgRoot.append(this.selectionRenderer.getElement());
        }

        if (p.hasEditMode) {
            this.modeToggle = new Options<TPreviewMode>({
                optionArr: (['edit', 'hand'] as const).map((id) => {
                    const el = BB.el({
                        className: 'dark-invert',
                        css: {
                            width: '28px',
                            height: '28px',
                            backgroundSize: 'contain',
                            margin: '5px',
                            backgroundImage: `url(${id === 'edit' ? (p.editIcon ?? editPencilImg) : toolHandImg})`,
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                        },
                    });

                    return {
                        id,
                        label: el,
                        title: id === 'edit' ? LANG('tab-edit') : LANG('tool-hand'),
                    };
                }),
                initId: 'edit',
                onChange: (val) => {
                    p.onModeChange && p.onModeChange(val);
                },
            });
        }

        // pointer-events: auto - So the canvas can be ignored, while the buttons still work.
        this.rootEl = c(
            {
                className: p.hasBorder === false ? undefined : classes.preview,
                css: {
                    position: 'relative',
                    zIndex: '0', // prevent buttons from sitting on top of other modals
                },
            },
            [
                this.viewport.getElement(),
                svgRoot,
                ...(this.modeToggle
                    ? [
                          c(',pos-absolute,left-5,top-5,z-1,pointer-auto', [
                              this.modeToggle.getElement(),
                          ]),
                      ]
                    : []),
                c(',pos-absolute,right-5,bottom-5,flex,flexCol,gap-5,z-1,pointer-auto', [
                    c({
                        tagName: 'button',
                        title: LANG('hand-reset'),
                        onClick: () => {
                            this.reset();
                        },
                        content: `<img alt="reset" height="20" src="${viewportResetImg}">`,
                        noRef: true,
                    }),
                    c({
                        tagName: 'button',
                        title: LANG('zoom-in'),
                        onClick: () => {
                            const oldScale = this.viewport.getTransform().scale;
                            const newScale = zoomByStep(oldScale, 1);
                            this.transformCanvas({
                                type: 'zoom',
                                fac: newScale / oldScale,
                            });
                        },
                        content: `<img alt="zoom-in" height="20" src="${toolZoomInImg}">`,
                        noRef: true,
                    }),
                    c({
                        tagName: 'button',
                        title: LANG('zoom-out'),
                        onClick: () => {
                            const oldScale = this.viewport.getTransform().scale;
                            const newScale = zoomByStep(oldScale, -1);
                            this.transformCanvas({
                                type: 'zoom',
                                fac: newScale / oldScale,
                            });
                        },
                        content: `<img alt="zoom-out" height="20" src="${toolZoomOutImg}">`,
                        noRef: true,
                    }),
                ]),
            ],
        );
        this.renderLoop();
    }

    render(): void {
        this.requestRerender();
    }

    setTransform(transform: TViewportTransform): void {
        this.viewport.setTransform(transform);
        this.requestRerender();
        this.isReset = false;
    }

    getTransform(): TViewportTransform {
        return this.viewport.getTransform();
    }

    onPointer(event: TPointerEvent): void {
        this.pointerChain.chainIn(event);
    }

    onWheel = (e: TWheelEvent): void => {
        const viewportRect = this.viewport.getElement().getBoundingClientRect();
        const vX = e.pageX - viewportRect.x;
        const vY = e.pageY - viewportRect.y;

        const oldScale = this.viewport.getTransform().scale;
        const newScale = zoomByStep(oldScale, -e.deltaY / 2);

        this.transformCanvas({
            type: 'zoom',
            vX,
            vY,
            fac: newScale / oldScale,
        });
    };

    getElement(): HTMLElement {
        return this.rootEl;
    }

    destroy(): void {
        this.animationFrameId !== undefined && cancelAnimationFrame(this.animationFrameId);
        this.viewport.destroy();
        this.viewportPointerListener.destroy();
        this.rootEl.remove();
        this.modeToggle && this.modeToggle.destroy();
        this.selectionRenderer?.destroy();
    }
}
