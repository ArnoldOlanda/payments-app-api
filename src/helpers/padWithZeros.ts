export function padWithZeros(num:number, totalLength:number) {
    return num.toString().padStart(totalLength, '0');
}