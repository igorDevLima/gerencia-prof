// Tela de Backup e integrações (exportar/importar, Google Drive, dados).
import { view } from "../../app/shell.js";
import { escapeHtml } from "../../core/ui/escape.js";
import { pluralize } from "../../core/ui/format.js";
import { toast } from "../../core/ui/toast.js";
import { confirmDialog } from "../../core/ui/modal.js";
import { navigate } from "../../app/router.js";
import { deliverFile } from "../../app/deliver.js";
import { exportData, importData, clearAll, getSettings, setSettings } from "../../core/db.js";
import { getStats } from "../dashboard/dashboard.store.js";
import { loadSampleData } from "../../app/sampleData.js";
import { DriveSync } from "./drive.js";

// Aviso quando o app está em file:// (Drive exige http/https).
function driveProtocolWarning() {
  if (DriveSync && DriveSync.isSupported()) return "";
  return `<p class="text-sm" style="color:var(--warning)">
    ⚠️ Para usar o Google Drive, abra o app por <strong>http/https</strong>
    (ex.: <code>npm run dev</code> ou GitHub Pages). Não funciona abrindo o arquivo direto (file://).
  </p>`;
}

export function renderBackup() {
  const s = getStats();
  const settings = getSettings();
  view.innerHTML = `
    <div class="section-head">
      <div>
        <h2 class="mt-0 mb-0">Backup e dados</h2>
        <p>Seus dados ficam salvos apenas neste navegador. Faça backups periódicos.</p>
      </div>
    </div>

    <div class="card"><div class="card__body">
      <h3 class="mt-0">⚠️ Importante</h3>
      <p class="text-sm">
        Este aplicativo é 100% gratuito e funciona sem internet. Os dados são gravados
        no armazenamento local deste dispositivo/navegador. Se você limpar os dados do
        navegador, trocar de aparelho ou reinstalar, <strong>perderá as informações</strong>.
        Por isso, exporte um arquivo de backup com frequência.
      </p>
      <p class="text-sm muted mb-0">
        Atualmente: ${s.teachers} ${pluralize(s.teachers, "professor", "professores")},
        ${s.tasks} ${pluralize(s.tasks, "tarefa", "tarefas")},
        ${s.observations} ${pluralize(s.observations, "observação", "observações")}.
      </p>
    </div></div>

    <div class="card"><div class="card__body">
      <h3 class="mt-0">Exportar (backup)</h3>
      <p class="text-sm">Baixe um arquivo <code>.json</code> com todos os dados.</p>
      <button class="btn" id="btnExport">⬇️ Exportar backup</button>
    </div></div>

    <div class="card"><div class="card__body">
      <h3 class="mt-0">Importar (restaurar)</h3>
      <p class="text-sm">Carregue um arquivo de backup. Você pode substituir tudo ou mesclar.</p>
      <div class="field">
        <input class="input" type="file" id="fileImport" accept="application/json,.json" />
      </div>
      <label class="checkbox-row" style="margin-bottom:14px">
        <input type="checkbox" id="mergeImport" />
        <span>Mesclar com os dados atuais (em vez de substituir)</span>
      </label>
      <button class="btn" id="btnImport">⬆️ Importar</button>
    </div></div>

    <div class="card"><div class="card__body">
      <h3 class="mt-0">☁️ Google Drive (opcional)</h3>
      <p class="text-sm">
        Envie automaticamente as exportações (.docx, CSV e backup) para o seu Google Drive.
        O app usa o acesso <strong>mínimo</strong> (<code>drive.file</code>): só vê os arquivos
        que ele mesmo cria — nunca o resto do seu Drive.
      </p>
      ${driveProtocolWarning()}
      <div class="field">
        <label for="driveClientId">Client ID do OAuth (Google Cloud)</label>
        <input class="input" id="driveClientId" placeholder="000000-xxxx.apps.googleusercontent.com"
               value="${escapeHtml(settings.googleClientId || "")}" />
        <div class="hint">Como obter: veja o passo a passo no README (seção Google Drive).</div>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="driveFolder">Pasta no Drive</label>
          <input class="input" id="driveFolder" value="${escapeHtml(settings.driveFolder || "Gerência Prof")}" />
        </div>
      </div>
      <label class="checkbox-row" style="margin-bottom:10px">
        <input type="checkbox" id="driveEnabled" ${settings.driveEnabled ? "checked" : ""} />
        <span>Enviar as exportações para o Google Drive</span>
      </label>
      <label class="checkbox-row" style="margin-bottom:14px">
        <input type="checkbox" id="driveKeepLocal" ${settings.driveKeepLocal ? "checked" : ""} />
        <span>Também manter uma cópia local (download)</span>
      </label>
      <div class="flex gap wrap">
        <button class="btn btn--ghost" id="driveSave">Salvar configuração</button>
        <button class="btn" id="driveConnect">Conectar / testar</button>
      </div>
      <p class="text-sm ${settings.driveEnabled ? "" : "muted"}" id="driveStatus" style="margin-bottom:0;margin-top:12px">
        ${settings.driveEnabled ? "Envio ao Drive ativado. Use \"Conectar / testar\" para autorizar." : "Envio ao Drive desativado."}
      </p>
    </div></div>

    <div class="card"><div class="card__body">
      <h3 class="mt-0">Outras ações</h3>
      <div class="flex gap wrap">
        <button class="btn btn--ghost" id="btnSample">Carregar dados de exemplo</button>
        <button class="btn btn--danger" id="btnClear">Apagar todos os dados</button>
      </div>
    </div></div>`;

  view.querySelector("#btnExport").addEventListener("click", () => {
    const stamp = new Date().toISOString().slice(0, 10);
    deliverFile(`gerencia-prof-backup-${stamp}.json`, exportData(), "application/json", "Backup");
  });

  view.querySelector("#btnImport").addEventListener("click", () => {
    const fileInput = view.querySelector("#fileImport");
    const merge = view.querySelector("#mergeImport").checked;
    const file = fileInput.files && fileInput.files[0];
    if (!file) { toast("Selecione um arquivo de backup.", "danger"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result, { merge });
        toast("Dados importados com sucesso.", "success");
        navigate("painel");
      } catch (err) {
        toast(err.message || "Falha ao importar.", "danger");
      }
    };
    reader.onerror = () => toast("Não foi possível ler o arquivo.", "danger");
    reader.readAsText(file);
  });

  view.querySelector("#btnSample").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Carregar dados de exemplo",
      message: "Isto substituirá os dados atuais por um conjunto de demonstração. Continuar?",
      confirmText: "Carregar exemplo",
      danger: true,
    });
    if (!ok) return;
    loadSampleData();
    toast("Dados de exemplo carregados.", "success");
    navigate("painel");
  });

  view.querySelector("#btnClear").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: "Apagar todos os dados",
      message: "Todos os professores e tarefas serão apagados deste dispositivo. Esta ação não pode ser desfeita. Tem certeza?",
      confirmText: "Apagar tudo",
      danger: true,
    });
    if (!ok) return;
    clearAll();
    toast("Todos os dados foram apagados.", "success");
    navigate("painel");
  });

  // --- Google Drive ---
  const readDriveFields = () => ({
    googleClientId: view.querySelector("#driveClientId").value.trim(),
    driveFolder: view.querySelector("#driveFolder").value.trim() || "Gerência Prof",
    driveEnabled: view.querySelector("#driveEnabled").checked,
    driveKeepLocal: view.querySelector("#driveKeepLocal").checked,
  });
  const driveStatus = view.querySelector("#driveStatus");

  view.querySelector("#driveSave").addEventListener("click", () => {
    setSettings(readDriveFields());
    toast("Configuração do Drive salva.", "success");
  });

  view.querySelector("#driveConnect").addEventListener("click", async () => {
    const cfg = setSettings(readDriveFields());
    if (!cfg.googleClientId) { toast("Informe o Client ID do OAuth.", "danger"); return; }
    if (!DriveSync.isSupported()) {
      toast("Abra o app por http/https (localhost ou site) para usar o Drive.", "danger");
      return;
    }
    driveStatus.textContent = "Conectando ao Google…";
    driveStatus.classList.remove("muted");
    try {
      await DriveSync.connect();
      driveStatus.textContent = "Conectado ao Google Drive com sucesso. As exportações irão para a pasta \"" + cfg.driveFolder + "\".";
      toast("Conectado ao Google Drive.", "success");
    } catch (err) {
      console.error(err);
      driveStatus.textContent = "Falha ao conectar: " + (err && err.message ? err.message : "erro desconhecido");
      toast("Falha ao conectar ao Drive.", "danger");
    }
  });
}
