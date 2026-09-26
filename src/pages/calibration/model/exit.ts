/** Where «Сохранить» and «Пропустить» lead: back to the settings when they opened the screen (`{ from: 'settings' }`), else the menu. */
export function calibrationExit(from: string | undefined): 'settings' | 'menu' {
  return from === 'settings' ? 'settings' : 'menu';
}
