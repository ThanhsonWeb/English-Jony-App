import { Languages, Construction } from "lucide-react";

function Page() {
	return (
		<div className="flex min-h-[70vh] items-center justify-center px-4">
			<div className="flex max-w-md flex-col items-center text-center">
				<div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-800 bg-slate-900">
					<Languages className="h-9 w-9 text-blue-400" />

					<div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-950">
						<Construction className="h-4 w-4 text-amber-400" />
					</div>
				</div>

				<h1 className="text-2xl font-bold text-slate-100">Từ vựng</h1>

				<p className="mt-3 text-sm leading-6 text-slate-400">
					Tính năng này đang được mình phát triển.
					<br />
					Mình đang cố gắng hoàn thiện nó sớm nhất có thể 🚀
				</p>

				<div className="mt-6 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400">
					Đang phát triển...
				</div>
			</div>
		</div>
	);
}

export default Page;
