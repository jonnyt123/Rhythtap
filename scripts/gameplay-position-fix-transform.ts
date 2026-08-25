import type {Plugin} from 'vite';

export function gameplayPositionFixTransform():Plugin{
  return {
    name:'rhythtap-gameplay-position-fix',
    enforce:'pre',
    transform(source,id){
      if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
      const marker="import './ux.css';";
      if(!source.includes(marker))throw new Error('[gameplay-position-fix] Unable to locate ux.css import.');
      return {code:source.replace(marker,`${marker}\nimport './gameplay-position-fix.css';`),map:null};
    }
  };
}
