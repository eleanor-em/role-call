function getImageElem(): HTMLImageElement {
    return document.getElementById("placing-object") as HTMLImageElement;
}

export function drawObject(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number): void {
    const elem = getImageElem();

    // Resize to fit grid
    let ratio;
    if (elem.width <= elem.height) {
        const width = Math.floor(elem.width / cellSize) * cellSize;
        ratio = width / elem.width;
    } else {
        const height = Math.floor(elem.height / cellSize) * cellSize;
        ratio = height / elem.height;
    }

    const width = elem.width * ratio;
    const height = elem.height * ratio;

    ctx.globalAlpha = 0.4;
    // Centre on the mouse, but biasing towards the top-left
    ctx.drawImage(elem, x - width / 2 + cellSize, y - height / 2 + cellSize, width, height);
    ctx.globalAlpha = 1.0;
}