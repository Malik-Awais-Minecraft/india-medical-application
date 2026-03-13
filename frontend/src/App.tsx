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

        {/* --- Q&A Section --- */}
        <div className="bg-white shadow rounded-xl p-8 mb-8 border border-indigo-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Ask a Medical Question
          </h2>
          <p className="text-sm text-gray-500 mb-5">Ask anything based on the uploaded medical guidelines. Answers are sourced from your ingested documents.</p>

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
              {qaLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Thinking...
                </>
              ) : 'Ask'}
            </button>
          </div>

          {qaError && (
            <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{qaError}</div>
          )}

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

        {/* --- Upload Section --- */}
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

        {/* --- Documents List --- */}
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
                    <th className="relative px-6 py-3"><span className="sr-only">Delete</span></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.filename}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${doc.status === 'completed' ? 'bg-green-100 text-green-800' :
                            doc.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                            doc.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'}`}>
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button onClick={() => handleDelete(doc.id)} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1 rounded transition duration-150">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
