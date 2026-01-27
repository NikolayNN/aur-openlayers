---

# Восстановление npm access token (для `npm publish`)

## Когда нужно

* `npm publish` падает с `E403`, `E401`, `token expired`
* npm пишет про `2FA / granular access token required`

---

## 1️. Отозвать старый токен

1. Зайти на **[https://www.npmjs.com](https://www.npmjs.com)**
2. Avatar → **Access Tokens**
3. Найти старый токен → **Revoke**

---

## 2️. Создать новый токен

1. **Access Tokens** → **Generate New Token**
2. Тип: **Granular**
3. **Packages:** `All packages`
4. **Permissions:** ✅ Read + ✅ Write
5. **2FA:** ✅ Enable **bypass 2FA**
6. **Create**
7. Скопировать токен (покажут один раз)

---

## 3️. Подключить токен локально (ОДИН РАЗ)

В PowerShell / CMD:

```bash
npm config set //registry.npmjs.org/:_authToken=NEW_TOKEN
```

Проверка:

```bash
npm whoami
```

(должен вывести твой npm-username)

---

## 4. Публикация

```bash
cd dist/lib
npm publish --access public
```

или просто:

```bash
publish.bat
```

---

## Важно

* ❌ **НЕ** вставлять токен в `.bat`
* ❌ **НЕ** коммитить `.npmrc` с токеном
* ✔️ Токен хранится в `~/.npmrc`
* ✔️ Для скриптов и IDE — **granular token с bypass 2FA** обязателен

---

## Если не работает

Проверить:

```bash
npm whoami
npm config get registry
```

Registry должен быть:

```
https://registry.npmjs.org/
```
