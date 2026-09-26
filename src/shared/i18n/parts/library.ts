/** «Моя музыка»: the catalog of the player's own songs, quota, storage (package C). Keys must not repeat those of other parts (see ru.test.ts). */
export const library = {
  // --- the list ---
  libTitle: 'Моя музыка',
  /** «2 из 3» — saved songs of the free slots. */
  libCountFree: '{n} из {max}',
  /** «37 песен · PASS» — no limit with NEON PASS. */
  libCountPass: '{n} {noun} · PASS',
  /** More songs than free slots (kept after NEON PASS ended): «5 песен · мест: 3». */
  libCountOver: '{n} {noun} · мест: {max}',
  libSongsNoun: ['песня', 'песни', 'песен'],
  libSearchPlaceholder: 'Название или исполнитель',
  libSearchAria: 'Поиск по песням',
  libSortAria: 'Порядок песен',
  libSort: { recent: 'Недавние', az: 'А–Я', level: 'Сложность' },
  libEmpty: 'Здесь будут твои песни',
  libNoResults: 'Ничего не нашлось',
  /** A song without a record yet. */
  libNoBest: '—',
  libAdd: 'Добавить',
  /** The «⋯» button: the selected song's details. */
  libMore: 'Ещё',
  /** Delete mode, next to the tag in the sub row (about 20 letters fit there). */
  libFreeHint: 'Выбери, что удалить',
  libIosHint: 'Добавь игру на экран «Домой» — так песни не пропадут',
  libEvicted: 'Браузер очистил сохранённые песни',
  // --- the song's details ---
  libBpm: 'BPM',
  libLength: 'длина',
  libAddedOn: 'добавлена {date}',
  libLevel: 'сложность',
  libRename: 'Переименовать',
  libRenameAria: 'Новое название',
  libSave: 'Сохранить',
  libDelete: 'Удалить',
  libDeleteTitle: 'Удалить песню?',
  libDeleteSub: 'рекорд пропадёт',
  libCancel: 'Отмена',
  libClose: 'Закрыть',
  /** Rename or delete failed in the storage (the sheet stays, the tap can be repeated). */
  libSaveFailed: 'Не получилось — попробуй ещё раз',
  /** The song was deleted in another tab meanwhile. */
  libSongGone: 'Песня уже удалена',
  // --- the free slots ---
  libLimitTitle: 'Три песни уже твои!',
  libLimitLine: 'Чтобы добавить новую, удали одну из них',
  /** The same sheet when there are more songs than slots (kept after NEON PASS ended). */
  libLimitFullTitle: 'Все места заняты',
  libLimitOverLine: 'Без NEON PASS мест три — удали лишние',
  libLimitPass: 'С NEON PASS — без лимита (скоро)',
  /** The limit sheet's primary button: its 20 px caps label fits about ten letters at 360 px, so «место» goes to the sub line. */
  libLimitFree: 'Освободить',
  libLimitFreeSub: 'место для новой песни',
  libLimitLater: 'Не сейчас',
  // --- adding a song ---
  libTooBig: 'файл больше 40 МБ',
  libTooShort: 'песня короче 30 секунд',
  libTooLong: 'песня длиннее 12 минут',
  libWeakRhythm: 'ритм слабый',
  libSavedTag: 'Сохранено',
  libAlreadyTag: 'Уже в твоей музыке',
  libOnceTag: 'Без сохранения',
  /** After a song is saved the file button picks another file (the saved one stays): not «Заменить». */
  libOtherFile: 'Ещё файл',
  libNoRoom: 'Места мало — удали старые песни',
  libNoStorage: 'Сохранение недоступно',
  /** The song sheet's row: the song composed again one ★ harder, from its saved file, and played at once. */
  libHarder: 'Сложнее · ★{n}',
} as const;
