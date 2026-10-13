export const UPLOAD_TYPES={ttf:'font/ttf',otf:'font/otf',woff:'font/woff',woff2:'font/woff2',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
/* Browsers often send fonts as '' or application/octet-stream; the server rejects those, so label by extension. */
export const withUploadType=(file)=>{const type=UPLOAD_TYPES[(file?.name||'').split('.').pop().toLowerCase()];return type&&file.type!==type&&typeof File!=='undefined'?new File([file],file.name,{type}):file;};
