export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-purple-200 mb-6">Video Not Found</h2>
        <p className="text-purple-300 mb-8 max-w-md">
          The golf video you're looking for doesn't exist or may have been removed.
        </p>
        <a 
          href="/"
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 inline-block"
        >
          Back to Golf Discovery
        </a>
      </div>
    </div>
  )
}