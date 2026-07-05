// Entrega de arquivos: envia ao Google Drive quando habilitado, senão baixa
// localmente (com fallback automático em caso de falha no envio).
import { downloadFile } from "../core/ui/files.js";
import { toast } from "../core/ui/toast.js";
import { getSettings } from "../core/db.js";
import { DriveSync } from "../features/backup/drive.js";

export function deliverFile(filename, content, mime, label) {
  label = label || "Arquivo";
  if (DriveSync && DriveSync.isEnabled()) {
    toast("Enviando para o Google Drive…");
    DriveSync.upload(filename, content, mime)
      .then(() => {
        toast(label + " enviado ao Google Drive.", "success");
        if (getSettings().driveKeepLocal) downloadFile(filename, content, mime);
      })
      .catch((err) => {
        console.error("Falha no envio ao Drive:", err);
        toast("Falha ao enviar ao Drive — baixando localmente.", "danger");
        downloadFile(filename, content, mime);
      });
    return;
  }
  downloadFile(filename, content, mime);
  toast(label + " gerado.", "success");
}
