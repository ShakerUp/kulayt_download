const TelegramBot = require('node-telegram-bot-api');
const { instagram } = require('nayan-media-downloader');
const { tikdown } = require('nayan-media-downloader');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const ytdl = require('@distube/ytdl-core');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID, 10);
const BASE_FOLDER = path.join(__dirname, process.env.BASE_FOLDER);

const bot = new TelegramBot(TOKEN, { polling: true });

// function getGroupPaths(chatId) {
//   const groupFolderPath = path.join(BASE_FOLDER, `group_${chatId}`);
//   const mediaFolderPath = path.join(groupFolderPath, `media`);
//   const messagesFilePath = path.join(groupFolderPath, 'messages.txt');

//   if (!fs.existsSync(groupFolderPath)) {
//     fs.mkdirSync(groupFolderPath, { recursive: true });
//   }
//   if (!fs.existsSync(mediaFolderPath)) {
//     fs.mkdirSync(mediaFolderPath, { recursive: true });
//   }
//   if (!fs.existsSync(messagesFilePath)) {
//     fs.writeFileSync(messagesFilePath, '', 'utf8');
//   }

//   return { mediaFolderPath, groupFolderPath, messagesFilePath };
// }

// function logMessage(msg, messagesFilePath) {
//   const logEntry = `${new Date().toISOString()} - ${msg.from.username || msg.from.first_name}: ${
//     msg.text
//   }\n`;
//   fs.appendFileSync(messagesFilePath, logEntry, 'utf8');
// }

// async function saveMedia(msg, mediaFolderPath) {
//   let filePath;
//   let fileStream;

//   if (msg.photo) {
//     const fileId = msg.photo[msg.photo.length - 1].file_id;
//     const file = await bot.getFile(fileId);
//     filePath = path.join(mediaFolderPath, `${msg.message_id}_photo.jpg`);
//     fileStream = fs.createWriteStream(filePath);
//     await axios({
//       url: `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`,
//       method: 'GET',
//       responseType: 'stream',
//     }).then((response) => {
//       response.data.pipe(fileStream);
//     });
//   } else if (msg.video) {
//     const fileId = msg.video.file_id;
//     const file = await bot.getFile(fileId);
//     filePath = path.join(mediaFolderPath, `${msg.message_id}_video.mp4`);
//     fileStream = fs.createWriteStream(filePath);
//     await axios({
//       url: `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`,
//       method: 'GET',
//       responseType: 'stream',
//     }).then((response) => {
//       response.data.pipe(fileStream);
//     });
//   } else if (msg.document) {
//     const fileId = msg.document.file_id;
//     const file = await bot.getFile(fileId);
//     filePath = path.join(mediaFolderPath, `${msg.message_id}_${msg.document.file_name}`);
//     fileStream = fs.createWriteStream(filePath);
//     await axios({
//       url: `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`,
//       method: 'GET',
//       responseType: 'stream',
//     }).then((response) => {
//       response.data.pipe(fileStream);
//     });
//   }

//   return new Promise((resolve) => {
//     if (fileStream) {
//       fileStream.on('finish', () => resolve(filePath));
//     } else {
//       resolve(null);
//     }
//   });
// }

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Привет! Отправь мне ссылку на Instagram Reels или TikTok, чтобы скачать видео.',
  );
});

// function createArchive(folderPath, outputPath) {
//   return new Promise((resolve, reject) => {
//     const archive = archiver('zip', {
//       zlib: { level: 9 },
//     });
//     const output = fs.createWriteStream(outputPath);
//     output.on('close', () => resolve());
//     archive.on('error', (err) => reject(err));

//     archive.pipe(output);
//     archive.directory(folderPath, false);
//     archive.finalize();
//   });
// }

// const { mediaFolderPath, groupFolderPath, messagesFilePath } = getGroupPaths(msg.chat.id);
// logMessage(msg, messagesFilePath);

bot.on('message', async (msg) => {
  const url = msg.text;

  if (url) {
    if (
      msg.chat.type === 'group' ||
      msg.chat.type === 'supergroup' ||
      msg.chat.type === 'private'
    ) {
      if (url.includes('instagram.com/reel/') || url.includes('instagram.com/p/')) {
        try {
          const data = await instagram(url);
          const videoUrl = data?.data?.video?.[0];
          const images = data?.data?.images || [];

          if (videoUrl) {
            const videoPath = await downloadVideo(videoUrl);
            await bot.sendVideo(msg.chat.id, videoPath, {
              contentType: 'video/mp4',
              reply_to_message_id: msg.message_id,
            });
            fs.unlinkSync(videoPath);
          } else if (images.length > 0) {
            if (images.length === 1) {
              await bot.sendPhoto(msg.chat.id, images[0], {
                reply_to_message_id: msg.message_id,
              });
            } else {
              const mediaGroup = images.map((imageUrl) => ({
                type: 'photo',
                media: imageUrl,
              }));
              await bot.sendMediaGroup(msg.chat.id, mediaGroup, {
                reply_to_message_id: msg.message_id,
              });
            }
          } else {
            bot.sendMessage(
              msg.chat.id,
              'Не удалось получить контент. Проверьте, правильно ли вы указали ссылку.',
              { reply_to_message_id: msg.message_id },
            );
          }
        } catch (error) {
          console.error(error);
          bot.sendMessage(
            msg.chat.id,
            'Произошла ошибка при скачивании контента. Пожалуйста, попробуйте позже.',
            { reply_to_message_id: msg.message_id },
          );
        }
      }

      // Обработка TikTok
      else if (url.includes('tiktok.com/') || url.includes('vm.tiktok.com/')) {
        try {
          const data = await tikdown(url);
          const videoUrl = data?.data?.video;
          const images = data?.data?.images || [];

          if (videoUrl) {
            const videoPath = await downloadVideo(videoUrl);
            await bot.sendVideo(msg.chat.id, videoPath, {
              contentType: 'video/mp4',
              reply_to_message_id: msg.message_id,
            });
            fs.unlinkSync(videoPath);
          } else if (images.length > 0) {
            if (images.length === 1) {
              await bot.sendPhoto(msg.chat.id, images[0], {
                reply_to_message_id: msg.message_id,
              });
            } else {
              const mediaGroup = images.map((imageUrl) => ({
                type: 'photo',
                media: imageUrl,
              }));
              await bot.sendMediaGroup(msg.chat.id, mediaGroup, {
                reply_to_message_id: msg.message_id,
              });
            }
          } else {
            bot.sendMessage(
              msg.chat.id,
              'Не удалось получить контент. Проверьте, правильно ли вы указали ссылку.',
              { reply_to_message_id: msg.message_id },
            );
          }
        } catch (error) {
          console.error(error);
          bot.sendMessage(
            msg.chat.id,
            'Произошла ошибка при скачивании контента. Пожалуйста, попробуйте позже.',
            { reply_to_message_id: msg.message_id },
          );
        }
      } //else if (url.includes('youtube.com/shorts/')) {
      //   try {
      //     const videoStream = ytdl(url, {
      //       filter: (format) => format.container === 'mp4' && format.hasVideo && format.hasAudio,
      //     });

      //     const videoPath = path.join(__dirname, `${uuidv4()}.mp4`);
      //     const writer = fs.createWriteStream(videoPath);

      //     videoStream.pipe(writer);

      //     writer.on('finish', async () => {
      //       await bot.sendVideo(msg.chat.id, videoPath, {
      //         reply_to_message_id: msg.message_id,
      //       });
      //       fs.unlinkSync(videoPath);
      //     });

      //     writer.on('error', (err) => {
      //       console.error(err);
      //       bot.sendMessage(
      //         msg.chat.id,
      //         'Произошла ошибка при скачивании видео. Пожалуйста, попробуйте позже.',
      //         {
      //           reply_to_message_id: msg.message_id,
      //         },
      //       );
      //     });
      //   } catch (error) {
      //     console.error(error);
      //     bot.sendMessage(
      //       msg.chat.id,
      //       'Произошла ошибка при скачивании видео. Пожалуйста, попробуйте позже.',
      //       {
      //         reply_to_message_id: msg.message_id,
      //       },
      //     );
      //   }
      // }
    }
  }
});

// if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
//   await saveMedia(msg, mediaFolderPath);
// }

// if (msg.from.id === ADMIN_ID && msg.text === '/get_assets') {
//   const assetsArchivePath = path.join(BASE_FOLDER, `assets_group_assets.zip`);
//   await createArchive(BASE_FOLDER, assetsArchivePath);
//   bot.sendMessage(msg.chat.id, 'Вот архив со всеми активами:', {
//     reply_to_message_id: msg.message_id,
//   });
//   await bot.sendDocument(msg.chat.id, assetsArchivePath, {
//     reply_to_message_id: msg.message_id,
//   });
//   fs.unlinkSync(assetsArchivePath);
// }

// if (msg.from.id === ADMIN_ID && msg.text === '/clear_assets') {
//   if (fs.existsSync(BASE_FOLDER)) {
//     fs.rmSync(BASE_FOLDER, { recursive: true, force: true });
//     bot.sendMessage(msg.chat.id, 'Все активы были успешно удалены.', {
//       reply_to_message_id: msg.message_id,
//     });
//   } else {
//     bot.sendMessage(msg.chat.id, 'Папка активов не найдена.', {
//       reply_to_message_id: msg.message_id,
//     });
//   }
// }

async function downloadVideo(videoUrl) {
  const videoPath = path.join(__dirname, `${uuidv4()}.mp4`);
  const writer = fs.createWriteStream(videoPath);

  const response = await axios({
    url: videoUrl,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(videoPath));
    writer.on('error', (err) => reject(err));
  });
}
