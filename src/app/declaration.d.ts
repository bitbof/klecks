// Without this, TypeScript has trouble importing these file formats.

declare module '*.png' {
    const path: string;
    export default path;
}
declare module '*.jpg' {
    const path: string;
    export default path;
}
declare module '*.svg' {
    const path: string;
    export default path;
}
declare module '*.gif' {
    const path: string;
    export default path;
}
declare module '*.glsl' {
    const value: string;
    export default value;
}
declare module '*.json';
declare module '*.scss';
declare module '*.ttf' {
    const path: string;
    export default path;
}
declare module '*.woff2' {
    const path: string;
    export default path;
}
