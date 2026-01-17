import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  doc, 
  setDoc,
  orderBy
} from 'firebase/firestore';
import { 
  Leaf, 
  Search, 
  Camera, 
  BookOpen, 
  User, 
  LogOut, 
  ChevronRight, 
  Sparkles, 
  History,
  AlertTriangle,
  CheckCircle,
  X
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'doctor-planet-pro';
const apiKey = ""; // Handled by environment

// --- Mock Encyclopedia Data ---
const ENCYCLOPEDIA = [
  { name: "Early Blight", plant: "Tomato", severity: "High", symptoms: "Target-like brown spots on older leaves.", treatment: "Use copper fungicides and improve airflow." },
  { name: "Late Blight", plant: "Potato", severity: "Critical", symptoms: "Dark, water-soaked patches on leaves turning black.", treatment: "Destroy infected plants. Use certified seeds." },
  { name: "Rice Blast", plant: "Rice", severity: "High", symptoms: "Diamond-shaped lesions with gray centers.", treatment: "Apply Silicon fertilizers. Avoid excessive Nitrogen." },
  { name: "Yellow Rust", plant: "Wheat", severity: "Medium", symptoms: "Linear rows of orange-yellow pustules on leaves.", treatment: "Foliar spray of Propiconazole." },
  { name: "Corn Smut", plant: "Corn", severity: "Medium", symptoms: "Large white galls on ears or stalks that burst black spores.", treatment: "Remove galls before they burst. Crop rotation." }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('login'); // login, signup, home, scan, history, research
  const [activeTab, setActiveTab] = useState('home');
  const [selectedPlant, setSelectedPlant] = useState('All');
  const [scans, setScans] = useState([]);
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  // --- Auth Effect ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // For demo/prototype purposes, we allow anonymous but UI shows login
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) setView('app');
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Effect ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'scans'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScans(data);
    }, (err) => console.error(err));
    return () => unsubscribe();
  }, [user]);

  // --- Gemini API Logic ---
  const callGemini = async (prompt, imageData = null) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
    const isImage = !!imageData;
    
    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          ...(isImage ? [{ inlineData: { mimeType: "image/png", data: imageData.split(',')[1] } }] : [])
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            plant: { type: "STRING" },
            symptoms: { type: "STRING" },
            treatment: { type: "STRING" },
            severity: { type: "STRING" }
          }
        }
      }
    };

    for (let i = 0; i < 5; i++) {
      try {
        const res = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        return JSON.parse(data.candidates[0].content.parts[0].text);
      } catch (e) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
    throw new Error("AI Service Unavailable");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    await signInAnonymously(auth);
  };

  const handleScan = async () => {
    if (!previewImg) return;
    setIsScanning(true);
    try {
      const result = await callGemini("Analyze this plant leaf for diseases. Provide scientific details.", previewImg);
      setSelectedDisease(result);
      // Save to Firestore
      if (user) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'scans'), {
          ...result,
          timestamp: Date.now(),
          imageUrl: previewImg.substring(0, 1000) // Storing thumbnail/shorthand for demo
        });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewImg(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // --- UI Components ---
  if (authLoading) return <div className="h-screen flex items-center justify-center bg-green-50"><Sparkles className="animate-spin text-green-600" /></div>;

  if (!user || view === 'login' || view === 'signup') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
              <Leaf size={32} />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-gray-900">Doctor Planet Pro</h1>
            <p className="mt-2 text-sm text-gray-600">Advanced Agricultural Intelligence</p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={handleLogin}>
            <input type="email" placeholder="Email address" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" required />
            <input type="password" placeholder="Password" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none" required />
            <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100">
              Sign In to Farm
            </button>
          </form>

          <div className="text-center space-y-4">
            <button onClick={() => alert("Registration feature coming soon. Sign in anonymously enabled.")} className="text-sm text-green-600 font-medium">Create New Account</button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with</span></div>
            </div>
            <button onClick={() => signInAnonymously(auth)} className="w-full border border-gray-200 py-3 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-gray-50 transition-colors">
              <User size={18} /> Guest Access
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-green-600 p-1.5 rounded-lg text-white"><Leaf size={20} /></div>
          <span className="font-bold text-lg tracking-tight">Doctor Planet</span>
        </div>
        <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <div className="p-6 space-y-6 max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-1">AI Advisor</h2>
                <p className="text-green-100 text-sm mb-4">Describe symptoms or ask about crop care.</p>
                <button 
                  onClick={() => {
                    const q = prompt("What's happening with your crop?");
                    if (q) callGemini(q).then(setSelectedDisease);
                  }}
                  className="bg-white/20 backdrop-blur-md border border-white/30 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                >
                  <Sparkles size={16} /> Consult AI
                </button>
              </div>
              <Leaf className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" />
            </div>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg">Disease Library</h3>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {['All', 'Tomato', 'Potato', 'Rice', 'Corn'].map(p => (
                    <button 
                      key={p}
                      onClick={() => setSelectedPlant(p)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedPlant === p ? 'bg-green-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid gap-3">
                {ENCYCLOPEDIA.filter(d => selectedPlant === 'All' || d.plant === selectedPlant).map((d, i) => (
                  <div 
                    key={i} 
                    onClick={() => setSelectedDisease(d)}
                    className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-gray-800">{d.name}</h4>
                      <p className="text-xs text-gray-400 font-medium">{d.plant} • {d.severity}</p>
                    </div>
                    <ChevronRight className="text-gray-300" size={20} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'scan' && (
          <div className="p-6 space-y-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold">AI Diagnostic Scan</h2>
            <p className="text-gray-500 -mt-4 text-sm">Powered by deep learning benchmarks.</p>
            
            <div 
              className="aspect-square w-full bg-white border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
              onClick={() => document.getElementById('scan-file').click()}
            >
              <input type="file" id="scan-file" className="hidden" accept="image/*" onChange={onFileChange} />
              {previewImg ? (
                <img src={previewImg} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-8">
                  <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Camera className="text-gray-300" size={32} />
                  </div>
                  <p className="text-gray-400 font-medium">Capture or Upload Leaf Image</p>
                </div>
              )}
              {isScanning && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                  <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="font-bold tracking-widest animate-pulse">SCANNING...</p>
                </div>
              )}
            </div>

            <button 
              disabled={!previewImg || isScanning}
              onClick={handleScan}
              className="w-full bg-green-600 disabled:bg-gray-300 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-100 flex items-center justify-center gap-2"
            >
              {isScanning ? 'Processing...' : <><Sparkles size={18} /> Run AI Analysis</>}
            </button>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Recent Reports</h2>
            <div className="space-y-4">
              {scans.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No diagnostic history found.</p>
                </div>
              ) : (
                scans.map((s, i) => (
                  <div key={i} onClick={() => setSelectedDisease(s)} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 cursor-pointer shadow-sm">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                      <CheckCircle size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">{s.name}</h4>
                      <p className="text-xs text-gray-400">{s.plant} • {new Date(s.timestamp).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className="text-gray-300" size={20} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'research' && (
          <div className="p-6 max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">Literature Review</h2>
            <div className="prose prose-sm text-gray-600 leading-relaxed space-y-4">
              <p>Plant disease detection has been an active area of research due to its significant impact on agricultural productivity and food security. Traditional diagnosis methods rely on expert inspection, which is often subjective and inefficient for large-scale farming.</p>
              <div className="bg-blue-50 p-4 rounded-2xl border-l-4 border-blue-400 text-blue-800 font-medium">
                "Overall, the literature shows a clear progression from traditional machine learning to advanced deep learning approaches."
              </div>
              <p>Researchers have therefore explored automated approaches, primarily based on image processing and machine learning techniques. Early studies focused on classical image processing algorithms that extracted handcrafted features such as color, texture, and shape.</p>
              <p>The advent of deep learning, particularly Convolutional Neural Networks (CNNs), revolutionized the field. Models like AlexNet and VGGNet demonstrated high performance, while MobileNet enabled real-time mobile deployability.</p>
            </div>
          </div>
        )}
      </main>

      {/* Disease Detail Sheet */}
      {selectedDisease && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDisease(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${selectedDisease.severity?.toLowerCase().includes('high') || selectedDisease.severity?.toLowerCase().includes('critical') ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                  {selectedDisease.severity || 'Medium Risk'}
                </span>
                <h2 className="text-2xl font-bold mt-2">{selectedDisease.name}</h2>
                <p className="text-green-600 font-bold text-sm">{selectedDisease.plant}</p>
              </div>
              <button onClick={() => setSelectedDisease(null)} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <AlertTriangle size={14} /> Symptoms
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">{selectedDisease.symptoms}</p>
              </div>
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <CheckCircle size={14} /> Recommended Treatment
                </h4>
                <p className="text-gray-700 text-sm leading-relaxed bg-green-50 p-4 rounded-xl border border-green-100 font-medium">{selectedDisease.treatment}</p>
              </div>
            </div>
            
            <button onClick={() => setSelectedDisease(null)} className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl">
              Close Report
            </button>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex justify-around items-center z-40 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
        <NavButton icon={<Search size={22} />} label="Explore" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavButton icon={<Camera size={22} />} label="Scan" active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} />
        <NavButton icon={<History size={22} />} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <NavButton icon={<BookOpen size={22} />} label="Research" active={activeTab === 'research'} onClick={() => setActiveTab('research')} />
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 flex-1 transition-all ${active ? 'text-green-600' : 'text-gray-400'}`}
    >
      <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-green-50 scale-110' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
