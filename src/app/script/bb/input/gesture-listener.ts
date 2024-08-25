export type TGestureEvent = UIEvent &
    Event & {
        scale: number;
        layerX: number; // like relX
        layerY: number; // like relY
    };

export type TGestureListenerParams = {
    target: Element;
    onStart?: (e: TGestureEvent) => void;
    onChange?: (e: TGestureEvent) => void;
    onEnd?: (e: TGestureEvent) => void;
};

type TGenericListener = (e: Event) => void;

export class GestureListener {
    private target: Element;
    private onStart: TGestureListenerParams['onStart'];
    private onChange: TGestureListenerParams['onChange'];
    private onEnd: TGestureListenerParams['onEnd'];

    // ----------------------------------- public -----------------------------------
    constructor(p: TGestureListenerParams) {
        this.target = p.target;
        this.onStart = p.onStart;
        this.onChange = p.onChange;
        this.onEnd = p.onEnd;

        this.onStart &&
            this.target.addEventListener('gesturestart', this.onStart as TGenericListener, {
                passive: false,
            });
        this.onChange &&
            this.target.addEventListener('gesturechange', this.onChange as TGenericListener, {
                passive: false,
            });
        this.onEnd &&
            this.target.addEventListener('gestureend', this.onEnd as TGenericListener, {
                passive: false,
            });
    }

    destroy(): void {
        this.onStart &&
            this.target.removeEventListener('gesturestart', this.onStart as TGenericListener);
        this.onChange &&
            this.target.removeEventListener('gesturechange', this.onChange as TGenericListener);
        this.onEnd && this.target.removeEventListener('gestureend', this.onEnd as TGenericListener);
    }
}
