import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import { compressImage } from '../lib/imageCompress'

// Сжимает фото на клиенте и загружает через multipart (P0.5) — заменяет
// прежний FileReader.readAsDataURL, который отправлял сырой файл с камеры
// как data URL прямо в JSON-теле.
export function useUploadPhoto() {
  return useMutation({
    mutationFn: async (file: File) => {
      const blob = await compressImage(file)
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      try {
        const { url } = await api.upload<{ url: string }>('/uploads/photo', form)
        return url
      } catch (err) {
        // Страховка на случай, если сжатие не помогло уложиться в лимит
        // (например HEIC/очень крупный оригинал) — понятный текст вместо
        // технического "File too large" от Multer.
        if (err instanceof ApiError && err.status === 413) {
          throw new Error('Фото слишком большое, попробуйте другое')
        }
        throw err
      }
    },
  })
}
