// ideas: padding, gutter, other shapes

export function drawGrid(
    ctx: CanvasRenderingContext2D,
    cellsX: number,
    cellsY: number,
    thickness: number, // px
    color: string,
    opacity: number, // 0 - 1
): void {
    ctx.save();
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    thickness = Math.round(thickness);
    const thickIsRound = thickness % 2 === 0;

    ctx.beginPath();
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;

    for (let i = 0; i < cellsX - 1; i++) {
        const cw = w / cellsX;
        let pos = cw * (i + 1);
        if (thickIsRound) {
            pos = Math.round(pos);
        } else {
            pos = Math.round(pos + 0.5) - 0.5;
        }
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, h);
    }
    for (let i = 0; i < cellsY - 1; i++) {
        const ch = h / cellsY;
        let pos = ch * (i + 1);
        if (thickIsRound) {
            pos = Math.round(pos);
        } else {
            pos = Math.round(pos + 0.5) - 0.5;
        }

        ctx.moveTo(0, pos);
        ctx.lineTo(w, pos);
    }

    ctx.stroke();
    ctx.restore();
}
