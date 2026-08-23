// unfocus buttons that are intended to be unfocused (tabIndex=-1)
export function setupUnfocusOnClickService(): void {
    document.addEventListener('click', (event) => {
        const target = event.target;
        const button = target instanceof Element ? target.closest('button') : null;

        if (
            button instanceof HTMLButtonElement &&
            button.tabIndex === -1 &&
            document.activeElement === button
        ) {
            button.blur();
        }
    });
}
