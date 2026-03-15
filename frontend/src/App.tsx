import { useState, useEffect } from 'react';

interface Document {
  id: number;
  filename: string;
  status: string;
  created_at: string;
}

interface QAResult {
  answer: string;
  sources: string[];
}

interface Chunk {
  index: number;
  text: string;
}

interface ChunkData {
  document_id: number;
  filename: string;
  total_chunks: number;
  chunks: Chunk[];
}

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Q&A state
  const [question, setQuestion] = useState('');
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // Chunk viewer state
  const [chunkData, setChunkData] = useState<ChunkData | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  const [expandedChunk, setExpandedChunk] = useState<number | null>(null);

  useEffect(() => {
    fetchDocuments();
    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      setDocuments(await response.json());
    } catch (err: any) {
      setError(err.message || 'Could not connect to backend.');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pdf')) { setError('Only PDF files are allowed.'); return; }
    setUploading(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/upload/`, { method: 'POST', body: formData });
      if (!response.ok) { const e = await response.json(); throw new Error(e.detail || 'Upload failed'); }
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (chunkData?.document_id === id) setChunkData(null);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      fetchDocuments();
    } catch { alert('Failed to delete document'); }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    setQaLoading(true); setQaError(null); setQaResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/qa/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.detail || 'Q&A failed'); }
      setQaResult(await response.json());
    } catch (err: any) {
      setQaError(err.message || 'Failed to get answer.');
    } finally {
      setQaLoading(false);
    }
  };

  const handleViewChunks = async (doc: Document) => {
    if (chunkData?.document_id === doc.id) { setChunkData(null); return; }
    setChunkLoading(true); setChunkData(null); setExpandedChunk(null);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${doc.id}/chunks`);
      if (!response.ok) throw new Error('Failed to load chunks');
      setChunkData(await response.json());
    } catch (err: any) {
      alert(err.message || 'Failed to load chunks');
    } finally {
      setChunkLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">Residency Companion</h1>
          <p className="mt-3 text-xl text-gray-500">AI-Powered Medical Decision Support</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center shadow-sm">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {error}
          </div>
        )}

        {/* Q&A Section */}
        <div className="bg-white shadow rounded-xl p-8 mb-8 border border-indigo-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Ask a Medical Question
          </h2>
          <p className="text-sm text-gray-500 mb-5">Ask anything based on the uploaded medical guidelines.</p>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              placeholder="e.g. What are the ICMR guidelines for diabetes management?"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleAskQuestion}
              disabled={qaLoading || !question.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-5 py-2 rounded-lg text-sm font-semibold transition duration-150 flex items-center gap-2"
            >
              {qaLoading ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Thinking...</>) : 'Ask'}
            </button>
          </div>
          {qaError && <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{qaError}</div>}
          {qaResult && (
            <div className="border border-indigo-100 rounded-xl p-5 bg-indigo-50 mt-3">
              <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{qaResult.answer}</p>
              {qaResult.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-indigo-200">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {qaResult.sources.map((src, i) => (
                      <span key={i} className="px-2 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs rounded-full font-medium">{src}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="bg-white shadow rounded-xl p-8 mb-8 border border-gray-100 hover:shadow-md transition-all">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            Upload Medical Guidelines
          </h2>
          <div className="flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded-xl p-10 bg-gray-50 hover:bg-gray-100 transition duration-150">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <label htmlFor="file-upload" className="cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 px-3 py-1 shadow-sm border border-gray-200 text-sm">
              <span>Choose a PDF</span>
              <input id="file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileUpload} disabled={uploading}/>
            </label>
            <p className="text-xs text-gray-500 mt-2">PDF files up to 50MB</p>
          </div>
          {uploading && (
            <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
              <svg className="animate-spin mr-3 h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Uploading and processing...
            </div>
          )}
        </div>

        {/* Documents List */}
        <div className="bg-white shadow rounded-xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              Ingested Guidelines
            </h2>
            <button onClick={fetchDocuments} className="text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition duration-150">Refresh</button>
          </div>

          {documents.length === 0 ? (
            <p className="text-gray-500 text-center py-10 bg-gray-50 rounded-lg border border-gray-100 italic">No documents uploaded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded At</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <tr key={doc.id} className={`transition duration-150 ${chunkData?.document_id === doc.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.filename}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                            doc.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            doc.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleViewChunks(doc)}
                            disabled={doc.status !== 'completed'}
                            title={doc.status !== 'completed' ? 'Available once processing completes' : ''}
                            className={`px-3 py-1 rounded text-xs font-medium transition duration-150 ${
                              chunkData?.document_id === doc.id
                                ? 'bg-indigo-600 text-white'
                                : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed'
                            }`}
                          >
                            {chunkData?.document_id === doc.id ? 'Hide Chunks' : 'View Chunks'}
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-xs font-medium transition duration-150"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Chunk Viewer Panel */}
          {chunkLoading && (
            <div className="mt-6 flex items-center justify-center py-8 text-sm text-gray-400">
              <svg className="animate-spin mr-2 h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Loading chunks...
            </div>
          )}

          {chunkData && !chunkLoading && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{chunkData.filename}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">{chunkData.total_chunks} chunks</span>
                    &nbsp;— click a chunk to expand
                  </p>
                </div>
                <button onClick={() => setChunkData(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Close</button>
              </div>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {chunkData.chunks.map((chunk) => (
                  <div
                    key={chunk.index}
                    onClick={() => setExpandedChunk(expandedChunk === chunk.index ? null : chunk.index)}
                    className={`border rounded-lg cursor-pointer transition-all duration-150 ${
                      expandedChunk === chunk.index
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 bg-gray-50 hover:border-indigo-200 hover:bg-indigo-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          #{chunk.index + 1}
                        </span>
                        {expandedChunk !== chunk.index && (
                          <p className="text-sm text-gray-600 truncate">
                            {chunk.text.slice(0, 120)}{chunk.text.length > 120 ? '…' : ''}
                          </p>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${expandedChunk === chunk.index ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                    {expandedChunk === chunk.index && (
                      <div className="px-4 pb-4 border-t border-indigo-100 pt-3">
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
                        <p className="text-xs text-gray-400 mt-3 text-right">{chunk.text.length} characters</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
