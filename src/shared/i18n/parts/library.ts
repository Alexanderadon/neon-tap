/** «Моя музыка»: the catalog of the player's own songs, quota, storage (package C). Keys must not repeat those of other parts (see ru.test.ts). */
export const library = {
  // --- the list ---
  libTitle: 'Моя музыка',
  /** «2 из 3» — saved songs of the free slots. */
  libCountFree: '{n} из {max}',
  /** «37 песен · PASS» — no limit with NEON PASS. */
  libCountPass: '{n} {noun} · PASS',
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
  libPickSong: 'выбери песню',
  libFreeHint: 'Выбери песню, которую удалить',
  libIosHint: 'Добавь игру на экран «Домой» — так песни не пропадут',
  libEvicted: 'Браузер очистил сохранённые песни',
  // --- the song's details ---
  libBpm: 'BPM',
  libLength: 'длина',
  libAdded: 'добавлена',
  libRename: 'Переименовать',
  libRenameAria: 'Новое название',
  libSave: 'Сохранить',
  libDelete: 'Удалить',
  libDeleteTitle: 'Удалить песню?',
  libDeleteSub: 'рекорд пропадёт',
  libCancel: 'Отмена',
  libClose: 'Закрыть',
  // --- the free slots ---
  libLimitTitle: 'Три песни уже твои!',
  libLimitLine: 'Чтобы добавить новую, удали одну из них',
  libLimitPass: 'С NEON PASS — без лимита (скоро)',
  libLimitFree: 'Освободить место',
  libLimitFreeSub: 'выбери песню для удаления',
  libLimitLater: 'Не сейчас',
  // --- adding a song ---
  libTooBig: 'файл больше 40 МБ',
  libTooShort: 'песня короче 30 секунд',
  libTooLong: 'песня длиннее 12 минут',
  libWeakRhythm: 'ритм слабый',
  libSavedTag: 'Сохранено',
  libAlreadyTag: 'Уже в твоей музыке',
  libOnceTag: 'Без сохранения',
  libNoRoom: 'Места мало — удали старые песни',
  libNoStorage: 'Сохранение недоступно',
} as const;
