using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Portfolio.Api.Utils
{
    public static class FileSignatureValidator
    {
        // Map of MIME type to list of valid file signatures (magic bytes)
        private static readonly Dictionary<string, List<byte[]>> Signatures = new()
        {
            // Images
            { "image/png", new List<byte[]> { new byte[] { 0x89, 0x50, 0x4E, 0x47 } } }, // PNG
            { "image/jpeg", new List<byte[]> { new byte[] { 0xFF, 0xD8, 0xFF } } }, // JPEG
            { "image/gif", new List<byte[]> { new byte[] { 0x47, 0x49, 0x46, 0x38 } } }, // GIF
            { "image/webp", new List<byte[]> { new byte[] { 0x52, 0x49, 0x46, 0x46 } } }, // WEBP (RIFF)
            // Videos
            { "video/mp4", new List<byte[]> { new byte[] { 0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70 }, new byte[] { 0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70 } } }, // MP4
            { "video/quicktime", new List<byte[]> { new byte[] { 0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20 } } }, // MOV
            { "video/x-msvideo", new List<byte[]> { new byte[] { 0x52, 0x49, 0x46, 0x46 } } }, // AVI (RIFF)
            { "video/x-matroska", new List<byte[]> { new byte[] { 0x1A, 0x45, 0xDF, 0xA3 } } }, // MKV
            { "video/webm", new List<byte[]> { new byte[] { 0x1A, 0x45, 0xDF, 0xA3 } } }, // WEBM (same as MKV)
            // Documents
            { "application/pdf", new List<byte[]> { new byte[] { 0x25, 0x50, 0x44, 0x46 } } }, // PDF
            { "application/msword", new List<byte[]> { new byte[] { 0xD0, 0xCF, 0x11, 0xE0 } } }, // DOC (OLE)
            { "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new List<byte[]> { new byte[] { 0x50, 0x4B, 0x03, 0x04 } } }, // DOCX (ZIP)
            { "application/vnd.ms-excel", new List<byte[]> { new byte[] { 0xD0, 0xCF, 0x11, 0xE0 } } }, // XLS (OLE)
            { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new List<byte[]> { new byte[] { 0x50, 0x4B, 0x03, 0x04 } } }, // XLSX (ZIP)
        };

        public static bool IsValidSignature(Stream fileStream, string mimeType)
        {
            if (string.Equals(mimeType, "image/avif", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(mimeType, "image/avif-sequence", StringComparison.OrdinalIgnoreCase))
            {
                return IsValidAvifSignature(fileStream);
            }

            if (!Signatures.TryGetValue(mimeType, out var validSignatures))
                return false;

            // Read enough bytes for the longest signature for this type
            int maxLength = 0;
            foreach (var sig in validSignatures)
                if (sig.Length > maxLength) maxLength = sig.Length;

            var buffer = new byte[maxLength];
            int bytesRead = fileStream.Read(buffer, 0, maxLength);
            fileStream.Position = 0; // Reset stream position

            foreach (var sig in validSignatures)
            {
                if (bytesRead >= sig.Length)
                {
                    bool match = true;
                    for (int i = 0; i < sig.Length; i++)
                    {
                        if (buffer[i] != sig[i])
                        {
                            match = false;
                            break;
                        }
                    }
                    if (match) return true;
                }
            }
            return false;
        }

        private static bool IsValidAvifSignature(Stream fileStream)
        {
            var buffer = new byte[64];
            var originalPosition = fileStream.CanSeek ? fileStream.Position : 0;
            int bytesRead = fileStream.Read(buffer, 0, buffer.Length);
            if (fileStream.CanSeek) fileStream.Position = originalPosition;

            if (bytesRead < 16)
                return false;

            // AVIF is an ISOBMFF file with an ftyp box and avif/avis brand.
            if (buffer[4] != (byte)'f' || buffer[5] != (byte)'t' || buffer[6] != (byte)'y' || buffer[7] != (byte)'p')
                return false;

            bool IsAvifBrandAt(int offset) =>
                buffer[offset] == (byte)'a' &&
                buffer[offset + 1] == (byte)'v' &&
                buffer[offset + 2] == (byte)'i' &&
                (buffer[offset + 3] == (byte)'f' || buffer[offset + 3] == (byte)'s');

            if (IsAvifBrandAt(8))
                return true;

            return Enumerable.Range(16, bytesRead - 16)
                .Where(i => (i - 16) % 4 == 0 && i + 3 < bytesRead)
                .Any(IsAvifBrandAt);
        }
    }
}
