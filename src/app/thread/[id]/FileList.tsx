import { DriveFile } from "@/types";
import styles from "./thread.module.css";

export default function FileList({ files }: { files: DriveFile[] }) {
  if (files.length === 0) {
      return <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>ファイルはまだありません。</div>;
  }

  return (

    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {files.map((file) => (
            <a 
                key={file.id} 
                href={file.webViewLink} 
                target="_blank" 
                className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition-all hover:bg-zinc-800/80 hover:border-indigo-500/30"
            >
                 <div className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 p-2 transition-transform group-hover:scale-110">
                    <img src={file.iconLink || '/file_icon.png'} alt="" className="h-6 w-6 object-contain" />
                 </div>
                 <div className="text-center w-full">
                     <div className="truncate text-xs font-medium text-zinc-300 group-hover:text-white">{file.name}</div>
                 </div>
            </a>
        ))}
    </div>
  );
}
