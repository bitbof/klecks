import { BB } from '../../bb/bb';
import { KlCanvas } from '../canvas/kl-canvas';
import { klConfig } from '../kl-config';

export class UploadImage {
    private timeout: number | any
    private latestGeneration: string;
    private imageId: string;
    private generating: boolean;
    private queueNew: boolean;
    private style: GenerateStyle;
    private getImage(canvas: HTMLCanvasElement, filename: string, mimeType: string): Blob {
        const parts = canvas.toDataURL(mimeType).match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/);

        if (!parts) {
            throw new Error('saveImage: empty parts');
        }

        const binStr = atob(parts[3]);
        //convert to binary in ArrayBuffer
        const buf = new ArrayBuffer(binStr.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < view.length; i++) {
            view[i] = binStr.charCodeAt(i);
        }
        return new Blob([view], { 'type': parts[1] });
    }

    constructor(
        private getKlCanvas: () => KlCanvas,
        private backendUrl: string
    ) {
        this.latestGeneration = "";
        this.imageId = "";
        this.generating = false;
        this.queueNew = false;
        this.backendUrl = backendUrl;
        this.style = new GenerateStyle('(van gogh style:1.1) (Post-Impressionism:1.3) (Expressive:1.1), (bold brushstrokes:1.2), (vibrant colors:1.2), painting style, intense emotions, distorted forms, dynamic compositions, raw authenticity,',
             'photo, photorealistic, painting of Van Gogh, logo, cartoon, naked, tits, nude, porn');
     }

    Send(): void {
        if(this.timeout){
            clearTimeout(this.timeout);
        }
        if(this.generating){
            this.queueNew = true;
            return;
        }
        this.timeout = setTimeout(this.sendImpl, 100, this);
    }

    private async sendImpl(sender : UploadImage){
        sender.generating = true;
        const extension = 'png';
        const mimeType = 'image/png';
        const filename = BB.getDate() + klConfig.filenameBase + '.' + extension;
        const fullCanvas = sender.getKlCanvas().getCompleteCanvas(1);
        try {

            const image = sender.getImage(fullCanvas, filename, mimeType);
            await sender.sendData(image);
        } catch (error) { //fallback for old browsers
            throw new Error('failed png export');
        } finally{
            sender.generating = false;
            if(sender.queueNew){
                sender.queueNew = false;
                sender.Send();
            }
        }
    }

    async sendData(data: Blob) {

        const formData = new FormData();
        formData.append('file', data);
        formData.append('negativePrompt', this.style.negativePrompt);
        formData.append('positivePrompt', this.style.postivePrompt);

        var response = await fetch(this.backendUrl + '/generate', {
            method: 'POST',
            body: formData,
        });

        const responseJson = await response.json();

        this.latestGeneration = responseJson.imageBase64;
        this.imageId = responseJson.imageId;

        console.log('generation done: ' + this.imageId)
    }

    public getLatestGeneration(){
        return this.latestGeneration;
    }

    public getimageId(){
        return this.imageId;
    }

    public setStyle(style: string){
        var styles = new Map<string, GenerateStyle>();
        styles.set('Van Gogh', new GenerateStyle('(van gogh style:1.1) (Post-Impressionism:1.3) (Expressive:1.1), (bold brushstrokes:1.2), (vibrant colors:1.2), painting style, intense emotions, distorted forms, dynamic compositions, raw authenticity, vg, painting, <lora:vincent_van_gogh_xl.safetensors:0.5>',
             'photo, photorealistic, painting of Van Gogh, logo, cartoon, naked, tits, nude, porn'));
        styles.set('Rembrandt', new GenerateStyle('Rembrandt van Rijn style painting, oil painting, Baroque, chiaroscuro, dramatic lighting, realistic portraits, deep shadows, warm color palette, emotional depth, 17th-century Dutch art, RembrandtXL, <lora:RembrandtXL_v1.safetensors:1.0>', 
            'photo, photorealistic, logo, cartoon, naked, tits, nude, porn'));
        styles.set('Picasso', new GenerateStyle('painted by Picasso, Cubism, abstract, fragmented forms, bold colors, geometric shapes, surrealism, expressive, multiple perspectives, deconstructed figures, avant-garde, <lora:p1c4ss0_003-step00028000.safetensors:0.4>', 
            'photo, photorealistic, logo, cartoon, naked, tits, nude, porn'));
        styles.set('Photo', new GenerateStyle('a photo realistic painting, High detail, realistic textures, precise rendering, lifelike, sharp focus, true-to-life colors, fine brushwork, hyperrealism, clarity, exact replication',
             'logo, cartoon, naked, tits, nude, porn'));
        styles.set('Fantasy', new GenerateStyle('Imagine a scene rendered in the Global Fantasy Style, where vibrant hues merge seamlessly with deep shadows, creating a tapestry of color that is both rich and enchanting. The artwork features a harmonious blend of cultural patterns and motifs, resulting in a universal aesthetic that feels both familiar and otherworldly. Ethereal lighting casts a soft glow over intricate details, highlighting elaborate textures and fine embellishments. The composition is dynamic and fluid, guiding the eye through a landscape of wonder without focusing on specific objects. Overall, the style evokes a sense of magic and immersion, inviting viewers to lose themselves in a world of endless  possibilities. drkfntasy,<lora:darkfantasystyle.safetensors:1.0>',
             'photo, photorealistic, logo, cartoon, naked, tits, nude, porn'));
        styles.set('Halloween', new GenerateStyle('a spooky, gothic atmosphere with an eerie and mysterious mood. Utilize dark and moody colors, dramatic shadows, and subtle contrasts to evoke a chilling vibe. The style should suggest vintage horror with a macabre and haunting feel, incorporating autumnal tones and hints of the supernatural. Focus on conveying the overall ambience and emotional impact without depicting specific objects or scenes. halloween <lora:halloweenXL.safetensors:0.8>',
                'photo, photorealistic, logo, cartoon, naked, tits, nude, porn'));     

        var selectedStyle =  styles.get(style);
        this.style = selectedStyle ?? new GenerateStyle('Select failed', '');
    }

}

class GenerateStyle{
    postivePrompt: string;
    negativePrompt: string

    constructor(positivePrompt:string, negativePrompt:string) {
        this.negativePrompt = negativePrompt;
        this.postivePrompt = positivePrompt;
    }
}