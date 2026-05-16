interface Props {
  children: React.ReactNode;
}

export function PublicLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-[#eef1f6] flex flex-col">
      {/* Content */}
      <main className="max-w-7xl mx-auto w-full flex-1 px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#0c3d68] bg-[#0f4a7f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-blue-100">
          © {new Date().getFullYear()} MUNICIPALIDAD DE MOLINA · SISTEMA DE ATENCION AL VECINO
        </div>
      </footer>
    </div>
  );
}
