export function fmtBytes(bytes){
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while(value >= 1024 && i < units.length - 1){
    value /= 1024;
    i++;
  }
  const digits = value < 10 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[i]}`;
}
