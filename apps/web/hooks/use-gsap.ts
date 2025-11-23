import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';

export const useGsapAnimation = (
    animation: (ctx: gsap.Context, contextSafe?: (func: Function) => Function) => void | (() => void),
    dependencies: any[] = []
) => {
    const scope = useRef<HTMLDivElement>(null);

    useGSAP(animation, { scope, dependencies });

    return scope;
};

// Export gsap for convenience
export { gsap };
