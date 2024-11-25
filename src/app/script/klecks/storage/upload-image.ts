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
        private backendUrl: string,
        private session: string
    ) {
        this.latestGeneration = "";
        this.imageId = "";
        this.generating = false;
        this.queueNew = false;
        this.backendUrl = backendUrl;
        this.session = session;
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

        var response = await fetch(this.backendUrl + '/generate/' + this.session, {
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
        styles.set('Alphonso Mucha', new GenerateStyle('Elegant, intricate, symmetrical, flowing, organic, ornate, decorative, soft gradients, harmonious composition, pastel tones, detailed patterns, curved lines, delicate textures, vintage aesthetic, ethereal ambiance, refined, ornamental frames, smooth transitions, balanced design, romantic atmosphere.<lora:Alphonse Mucha Style.safetensors:0.5> Alphonse Mucha Style page',
                'photo, photorealistic, logo, cartoon, naked, tits, nude, porn'));   
        styles.set('Renaissance', new GenerateStyle(' Renaissance-style painting with a focus on realism and idealism, emphasizing naturalistic detail, harmonious composition, and lifelike textures. The image should incorporate balanced proportions, precise linear perspective, and rich, vibrant colors with a subtle use of chiaroscuro to highlight light and shadow dynamics. Include elements of classical influence, such as Greco-Roman architectural features or motifs, set against an intricate and expansive background with detailed landscapes or structures. Convey emotional depth through expressive poses, gestures, and facial expressions, creating a sense of narrative and timeless beauty. The overall aesthetic should exude harmony, sophistication, and intellectual elegance. painted in renaissance style, .<lora:edgRenaissanceXL.safetensors:0.65> ',
                'photo, photorealistic, logo, cartoon, naked, tits, nude, porn')); 
        styles.set('Vermeer', new GenerateStyle('Create a Vermeer-style painting depicting a serene, intimate interior scene bathed in soft, natural light streaming through a window. The composition should emphasize harmony and balance, with carefully arranged objects like draped fabrics, fine ceramics, or a table with subtle details. Use a muted, harmonious color palette featuring earthy tones, deep blues, and warm golden yellows. Capture the textures of fabrics, glass, and wood with hyper-realistic precision. The atmosphere should feel tranquil and contemplative, with a single figure or small group engaged in a quiet, meaningful activity. Incorporate diffused shadows, soft edges, and luminous highlights to mimic the gentle interplay of light and texture, creating a reflective and timeless mood. <lora:JohannesVermeerXL_v1.safetensors:0.5> JohannesVermeerXL',
                'photo, photorealistic, logo, cartoon, naked, tits, nude, porn')); 
        styles.set('Leonardo da Vinci', new GenerateStyle('An intricate and highly detailed painting, showcasing the style of Leonardo da Vinci. The scene features soft, blended edges and a seamless transition between light and shadow, a hallmark of sfumato. The background includes a serene, atmospheric landscape with distant mountains, hazy and dreamlike. The subject is a figure with lifelike proportions, capturing a deep sense of emotion and naturalism. The colors are muted and earthy, with a focus on subtle contrasts and delicate highlights. The use of perspective draws the viewer into the composition, creating depth and harmony, reminiscent of the Italian Renaissance, <lora:dvnc.safetensors:0.3> dvnc',
                'photo, photorealistic, logo, cartoon, naked, tits, nude, porn')); 
        styles.set('Caravaggio', new GenerateStyle('A dramatic and intense painting inspired by the style of Caravaggio. The scene is illuminated by sharp contrasts of light and shadow, employing chiaroscuro to create a theatrical effect. The subjects are depicted with raw, realistic details, showing the textures of skin, fabric, and objects with vivid accuracy. The composition emphasizes bold gestures and dynamic poses, drawing the viewers eye to the emotional core of the narrative. The background is dark and minimal, focusing attention on the brightly lit figures. The palette is rich and deep, with strong reds, ochres, and dark blacks, reflecting the powerful and evocative style of the Baroque era  <lora:caravaggio_XL_resize:0.9> crvgg, a painting of ***** by Crvgg',
                'photo, photorealistic, logo, cartoon, naked, tits, nude, porn')); 
        styles.set('Édouard Manet', new GenerateStyle('A painting in the style of Édouard Manet, characterized by bold, loose brushstrokes and a modern, impressionistic approach. The scene focuses on contemporary life, capturing candid, everyday moments with a sense of immediacy. The composition features a balance of light and dark tones, often with a dramatic use of contrast to draw attention to the central subject. The background is subtly suggested rather than detailed, leaving an air of spontaneity. The palette includes rich blacks, muted blues, and soft whites, often punctuated by warm, vibrant accents. The figures and objects are rendered with a blend of realism and painterly abstraction, evoking the transitional spirit between realism and impressionism. <lora:m4n3t:0.5> m4n3t',
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