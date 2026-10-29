const { Router } = require('express')
const fs = require('fs/promises')
const path = require('path')
const { uploadAvatar, uploadDocuments, uploadToMemory } = require('../middleware/upload')

const router = Router()

function handleUploadError(err, req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Файл слишком большой' })
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ error: 'Превышено максимальное количество файлов' })
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Неожиданное поле файла' })
  }
  if (err.message) {
    return res.status(400).json({ error: err.message })
  }
  next(err)
}

router.post('/avatar', uploadAvatar.single('avatar'), handleUploadError, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' })
  res.status(201).json({
    message: 'Аватар загружен',
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/avatars/${req.file.filename}`
    }
  })
})

router.post('/documents', uploadDocuments.array('documents', 5), handleUploadError, (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Файлы не загружены' })
  const files = req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimetype: file.mimetype,
    url: `/uploads/documents/${file.filename}`
  }))
  res.status(201).json({ message: `Загружено файлов: ${files.length}`, files })
})

router.post('/profile',
  uploadAvatar.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]),
  handleUploadError,
  (req, res) => {
    const { name, bio } = req.body
    const avatar = req.files?.avatar?.[0]
    const cover = req.files?.cover?.[0]
    if (!name) return res.status(400).json({ error: 'Поле name обязательно' })

    res.status(201).json({
      message: 'Профиль обновлён',
      profile: {
        name,
        bio: bio || '',
        avatar: avatar ? `/uploads/avatars/${avatar.filename}` : null,
        cover: cover ? `/uploads/avatars/${cover.filename}` : null
      }
    })
  }
)

router.post('/image/process', uploadToMemory.single('image'), handleUploadError, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' })
  const base64 = req.file.buffer.toString('base64')
  res.json({
    message: 'Файл получен в памяти',
    size: req.file.size,
    preview: `data:${req.file.mimetype};base64,${base64.substring(0, 50)}...`
  })
})

router.delete('/:folder/:filename', async (req, res) => {
  const { folder, filename } = req.params
  const allowed = ['avatars', 'documents']
  if (!allowed.includes(folder)) return res.status(400).json({ error: 'Недопустимая папка' })

  const safeName = path.basename(filename)
  const filePath = path.join('uploads', folder, safeName)

  try {
    await fs.unlink(filePath)
    res.json({ message: 'Файл удалён' })
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Файл не найден' })
    throw err
  }
})

module.exports = router