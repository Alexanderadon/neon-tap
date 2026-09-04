# Generates the Russian voice lines with the built-in Windows voice "Microsoft Irina".
# Output: assets-src/voice-raw/<id>.wav   (then run `npm run assets:voice`)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Irina Desktop')
$s.Rate = 1
$dir = Join-Path $PSScriptRoot '..\assets-src\voice-raw'
New-Item -ItemType Directory -Force $dir | Out-Null
$phrases = @{
  'otlichno'     = 'Отлично!'
  'molodec'      = 'Молодец!'
  'tak-derzhat'  = 'Так держать!'
  'idealno'      = 'Идеально!'
  'ne-sdavaysya' = 'Не сдавайся!'
  'ogon'         = 'Огонь!'
  'combo-50'     = 'Комбо пятьдесят!'
  'combo-100'    = 'Комбо сто!'
  'combo-250'    = 'Комбо двести пятьдесят!'
  'combo-500'    = 'Комбо пятьсот!'
  'full-combo'   = 'Полное комбо!'
  'poehali'      = 'Поехали!'
  'new-record'   = 'Новый рекорд!'
  'rank-s'       = 'Ранг эс!'
  'mimo'         = 'Мимо!'
  'eshche-razok' = 'Ещё разок?'
}
foreach ($k in $phrases.Keys) {
  $s.SetOutputToWaveFile((Join-Path $dir "$k.wav"))
  $s.Speak($phrases[$k])
}
$s.SetOutputToNull()
Write-Host "done: $($phrases.Count) phrases"
