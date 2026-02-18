import React, { useState, useRef, Component } from 'react';
import { Camera, Plus, Trash2, Check, User, Loader2, Share2, ArrowRight, Sparkles, AlertCircle, Edit2, X, ArrowLeft, Download, Save, Image } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Configuration ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// --- Utilities ---
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

// --- Components ---

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={32} className="text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
                        <p className="text-slate-500 mb-6 text-sm">
                            {this.state.error?.message || "An unexpected error occurred."}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors w-full"
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, icon: Icon, fullWidth = false }) => {
    const baseStyle = "flex items-center justify-center px-6 py-3.5 rounded-2xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
    const variants = {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
        danger: "bg-red-50 text-red-600 hover:bg-red-100",
        ghost: "text-slate-500 hover:bg-slate-100",
        outline: "border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
        >
            {Icon && <Icon size={20} className="mr-2" />}
            {children}
        </button>
    );
};

const Card = ({ children, className = '', onClick }) => (
    <div onClick={onClick} className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
        {children}
    </div>
);

const StepIndicator = ({ currentStep }) => {
    const steps = [
        { id: 'upload', label: 'Scan' },
        { id: 'users', label: 'People' },
        { id: 'assign', label: 'Assign' },
        { id: 'result', label: 'Split' }
    ];

    const activeIndex = steps.findIndex(s => s.id === currentStep);

    return (
        <div className="flex justify-between items-center px-8 py-6 bg-white border-b border-slate-100 sticky top-0 z-20">
            {steps.map((step, index) => {
                const isActive = index <= activeIndex;
                const isCurrent = step.id === currentStep;
                return (
                    <div key={step.id} className="flex flex-col items-center relative z-10">
                        <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
              ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400'}
              ${isCurrent ? 'ring-4 ring-indigo-50 scale-110' : ''}
            `}>
                            {index + 1}
                        </div>
                        <span className={`text-[10px] font-medium mt-1 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
            {/* Progress Line */}
            <div className="absolute left-0 right-0 top-[38px] h-0.5 bg-slate-100 -z-0 mx-10">
                <div
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                    style={{ width: `${(activeIndex / (steps.length - 1)) * 100}%` }}
                />
            </div>
        </div>
    );
};

// --- Main App Component ---

export default function App() {
    const [step, setStep] = useState('upload'); // upload, users, assign, result
    const [isLoading, setIsLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [tax, setTax] = useState(0);
    const [serviceCharge, setServiceCharge] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [error, setError] = useState(null);
    const [nameInput, setNameInput] = useState(''); // Moved state here to fix Hook violation
    const [isEditing, setIsEditing] = useState(false);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // --- Logic: AI Processing ---

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        setError(null);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = reader.result.split(',')[1];

                if (!apiKey) {
                    setError("Please add your Gemini API Key in src/App.jsx");
                    setIsLoading(false);
                    return;
                }

                try {
                    const genAI = new GoogleGenerativeAI(apiKey);
                    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

                    const prompt = `
            Analyze this receipt image. Extract items, prices, quantities, tax, service charge, and discounts.
            Return ONLY a valid JSON object with this structure:
            {
                "items": [
                    { "name": "Item Name", "price": 10000, "quantity": 1 }
                ],
                "tax": 0,
                "serviceCharge": 0,
                "discount": 0
            }
            CRITICAL RULE: If an item has a quantity > 1 (e.g., "2x Nasi Goreng"), you MUST split it into individual entries in the "items" array (e.g., two separate "Nasi Goreng" objects with quantity 1).
            Ensure all prices are numbers (no currency symbols).
            `;

                    const result = await model.generateContent([
                        prompt,
                        { inlineData: { data: base64Data, mimeType: file.type } }
                    ]);

                    const responseText = result.response.text();

                    // --- CRITICAL FIX: Clean Markdown and Parse Safely ---
                    let data;
                    try {
                        // Remove markdown code blocks if present
                        const cleanText = responseText.replace(/```json|```/g, '').trim();
                        // Find the first '{' and last '}' to ensure we only get the JSON object
                        const jsonStartIndex = cleanText.indexOf('{');
                        const jsonEndIndex = cleanText.lastIndexOf('}');

                        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
                            throw new Error("No JSON found in response");
                        }

                        const jsonString = cleanText.substring(jsonStartIndex, jsonEndIndex + 1);
                        data = JSON.parse(jsonString);
                    } catch (parseError) {
                        console.error("JSON Parse Error:", parseError);
                        console.log("Raw Response:", responseText);
                        throw new Error("Failed to read receipt data. Please try again.");
                    }

                    const processedItems = (data.items || []).map((item, index) => ({
                        ...item,
                        id: `item-${index}-${Date.now()}`,
                        assignedTo: []
                    }));

                    setItems(processedItems);
                    setTax(data.tax || 0);
                    setServiceCharge(data.serviceCharge || 0);
                    setDiscount(data.discount || 0);

                    // Move to next step
                    setStep('users');
                    setIsLoading(false);

                } catch (err) {
                    console.error("AI Error:", err);
                    setError(err.message || "Failed to analyze receipt. Please try again.");
                    setIsLoading(false);
                }
            };
        } catch (err) {
            setError("Error reading file.");
            setIsLoading(false);
        }
    };

    // --- Logic: User Management ---

    const addUser = (name) => {
        if (!name.trim()) return;
        const colors = [
            'bg-indigo-100 text-indigo-700 border-indigo-200',
            'bg-rose-100 text-rose-700 border-rose-200',
            'bg-emerald-100 text-emerald-700 border-emerald-200',
            'bg-amber-100 text-amber-700 border-amber-200',
            'bg-cyan-100 text-cyan-700 border-cyan-200',
            'bg-violet-100 text-violet-700 border-violet-200'
        ];
        const randomColor = colors[users.length % colors.length];
        setUsers([...users, { id: Date.now(), name, color: randomColor }]);
    };

    const removeUser = (id) => {
        setUsers(users.filter(u => u.id !== id));
        // Also remove assignments for this user
        setItems(items.map(item => ({
            ...item,
            assignedTo: item.assignedTo.filter(uid => uid !== id)
        })));
    };

    // --- Logic: Assignment ---

    const toggleAssignment = (itemId, userId) => {
        setItems(items.map(item => {
            if (item.id === itemId) {
                const isAssigned = item.assignedTo.includes(userId);
                const newAssigned = isAssigned
                    ? item.assignedTo.filter(id => id !== userId)
                    : [...item.assignedTo, userId];
                return { ...item, assignedTo: newAssigned };
            }
            return item;
        }));
    };

    // --- Logic: Calculation ---

    const calculateResults = () => {
        const userTotals = {};
        users.forEach(u => userTotals[u.id] = {
            subtotal: 0,
            taxShare: 0,
            serviceShare: 0,
            discountShare: 0,
            total: 0
        });

        let totalSubtotal = 0;

        items.forEach(item => {
            if (item.assignedTo.length > 0) {
                const splitPrice = item.price / item.assignedTo.length;
                item.assignedTo.forEach(userId => {
                    if (userTotals[userId]) {
                        userTotals[userId].subtotal += splitPrice;
                        totalSubtotal += splitPrice;
                    }
                });
            }
        });

        const safeTotalSubtotal = totalSubtotal || 1;

        users.forEach(u => {
            const user = userTotals[u.id];
            const ratio = user.subtotal / safeTotalSubtotal;

            user.taxShare = tax * ratio;
            user.serviceShare = serviceCharge * ratio;
            user.discountShare = discount * ratio;
            user.total = user.subtotal + user.taxShare + user.serviceShare - user.discountShare;
        });

        return { userTotals, totalSubtotal };
    };

    const renderEditModal = () => {
        if (!isEditing) return null;

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full max-w-md rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                    <div className="sticky top-0 bg-white p-4 border-b border-slate-100 flex justify-between items-center z-10 rounded-t-2xl">
                        <h3 className="font-bold text-lg">Edit Bill Details</h3>
                        <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-100 rounded-full">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 space-y-6 overflow-y-auto">
                        {/* Global Values */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Totals</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Tax</label>
                                    <input
                                        type="number"
                                        value={tax}
                                        onChange={(e) => setTax(Number(e.target.value))}
                                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Service Charge</label>
                                    <input
                                        type="number"
                                        value={serviceCharge}
                                        onChange={(e) => setServiceCharge(Number(e.target.value))}
                                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium text-slate-700 mb-1">Discount</label>
                                    <input
                                        type="number"
                                        value={discount}
                                        onChange={(e) => setDiscount(Number(e.target.value))}
                                        className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wider">Items</h4>
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={item.id} className="flex gap-2 items-start">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => {
                                                setItems(items.map((it, i) =>
                                                    i === idx ? { ...it, name: e.target.value } : it
                                                ));
                                            }}
                                            className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => {
                                                setItems(items.map((it, i) =>
                                                    i === idx ? { ...it, price: Number(e.target.value) } : it
                                                ));
                                            }}
                                            className="w-24 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-right transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-white p-4 border-t border-slate-100 rounded-b-2xl">
                        <Button onClick={() => setIsEditing(false)} fullWidth icon={Check}>
                            Done
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        const { userTotals, totalSubtotal } = calculateResults();

        // Title
        doc.setFontSize(20);
        doc.text("Bill Breakdown", 14, 22);
        doc.setFontSize(10);
        doc.text(new Date().toLocaleDateString(), 14, 28);

        // Grand Total
        const grandTotal = totalSubtotal + tax + serviceCharge - discount;

        autoTable(doc, {
            startY: 35,
            head: [['Description', 'Amount']],
            body: [
                ['Subtotal', formatCurrency(totalSubtotal)],
                ['Tax', formatCurrency(tax)],
                ['Service Charge', formatCurrency(serviceCharge)],
                ['Discount', `-${formatCurrency(discount)}`],
                ['GRAND TOTAL', formatCurrency(grandTotal)]
            ],
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        });

        let finalY = doc.lastAutoTable.finalY + 10;

        // Per User Breakdown
        users.forEach(user => {
            const data = userTotals[user.id];
            if (data.total === 0) return;

            const userItems = items.filter(item => item.assignedTo.includes(user.id));

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`${user.name} - ${formatCurrency(data.total)}`, 14, finalY);
            doc.setFont(undefined, 'normal');

            const tableBody = userItems.map(item => [
                item.name + (item.assignedTo.length > 1 ? ` (Split ${item.assignedTo.length})` : ''),
                formatCurrency(item.price / item.assignedTo.length)
            ]);

            // Add summary rows for user
            if (data.taxShare > 0 || data.serviceShare > 0) {
                tableBody.push(['Tax & Service', formatCurrency(data.taxShare + data.serviceShare)]);
            }
            if (data.discountShare > 0) {
                tableBody.push(['Discount', `-${formatCurrency(data.discountShare)}`]);
            }

            autoTable(doc, {
                startY: finalY + 2,
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14 }
            });

            finalY = doc.lastAutoTable.finalY + 10;

            // Add new page if needed
            if (finalY > 250) {
                doc.addPage();
                finalY = 20;
            }
        });

        doc.save("split-bill-result.pdf");
    };

    // --- Logic: Save Bill ---

    const saveBill = async () => {
        try {
            const { totalSubtotal } = calculateResults();
            const grandTotal = totalSubtotal + tax + serviceCharge - discount;

            const payload = {
                items,
                users,
                tax,
                serviceCharge,
                discount,
                total: grandTotal
            };

            const response = await fetch('/api/bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to save (Backend might not be running)');

            alert('Bill saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save bill. Make sure the backend server is running.\n\n' + err.message);
        }
    };

    // --- Render Steps ---

    const renderUpload = () => (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-8 animate-fade-in">
            <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full"></div>
                <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center relative z-10">
                    <Sparkles size={40} className="text-indigo-600" />
                </div>
            </div>

            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900">Smart Split Bill</h1>
                <p className="text-slate-500 max-w-xs mx-auto">Upload a receipt and let AI handle the math for you.</p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm w-full max-w-sm border border-red-100">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 size={32} className="text-indigo-600 animate-spin" />
                    <p className="text-sm font-medium text-slate-600">Analyzing Receipt...</p>
                </div>
            ) : (
                <div className="w-full max-w-xs space-y-4">
                    {/* Hidden Inputs */}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={cameraInputRef}
                        onChange={handleFileUpload}
                    />

                    {/* Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={() => cameraInputRef.current.click()}
                            className="flex-1"
                            icon={Camera}
                        >
                            Camera
                        </Button>
                        <Button
                            onClick={() => fileInputRef.current.click()}
                            variant="secondary"
                            className="flex-1"
                            icon={Image}
                        >
                            Gallery
                        </Button>
                    </div>

                    <p className="text-xs text-slate-400">Supported formats: JPG, PNG</p>
                </div>
            )
            }
        </div >
    );

    const renderUsers = () => {
        const handleAdd = () => {
            if (nameInput) {
                addUser(nameInput);
                setNameInput('');
            }
        };

        return (
            <div className="p-6 pb-32 animate-fade-in">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Who's splitting?</h2>
                    <p className="text-slate-500">Add everyone involved in this bill.</p>
                </div>

                <div className="flex gap-2 mb-8">
                    <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        placeholder="Enter name (e.g. John)"
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <Button onClick={handleAdd} className="!px-4 !py-3 !rounded-xl">
                        <Plus size={24} />
                    </Button>
                </div>

                <div className="space-y-3">
                    {users.map(user => (
                        <div key={user.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${user.color.split(' ')[0]} ${user.color.split(' ')[1]}`}>
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-700">{user.name}</span>
                            </div>
                            <button onClick={() => removeUser(user.id)} className="text-slate-400 hover:text-red-500 p-2">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {users.length === 0 && (
                        <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            No users added yet
                        </div>
                    )}
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 max-w-md mx-auto">
                    <Button
                        fullWidth
                        onClick={() => setStep('assign')}
                        disabled={users.length === 0}
                        icon={ArrowRight}
                    >
                        Next: Assign Items
                    </Button>
                </div>
            </div>
        );
    };

    const renderAssign = () => (
        <div className="pb-32 animate-fade-in">
            <div className="p-6 bg-slate-50 sticky top-[88px] z-10 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">Tap to assign</h2>
                <p className="text-sm text-slate-500">Select who ordered what.</p>
            </div>

            <div className="p-4 space-y-4">
                {items.map(item => (
                    <Card key={item.id} className="p-5">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-semibold text-slate-900 text-lg leading-tight">{item.name}</h3>
                            <p className="text-indigo-600 font-bold whitespace-nowrap ml-4">{formatCurrency(item.price)}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {users.map(user => {
                                const isSelected = item.assignedTo.includes(user.id);
                                return (
                                    <button
                                        key={user.id}
                                        onClick={() => toggleAssignment(item.id, user.id)}
                                        className={`
                      px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border
                      ${isSelected
                                                ? `${user.color} ring-2 ring-offset-1 ring-indigo-500/20`
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}
                    `}
                                    >
                                        {user.name}
                                    </button>
                                );
                            })}
                        </div>
                        {item.assignedTo.length === 0 && (
                            <div className="mt-3 text-xs text-red-400 flex items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2"></div>
                                Unassigned
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 max-w-md mx-auto">
                <Button onClick={() => setStep('result')} fullWidth icon={Check}>
                    Calculate Split
                </Button>
            </div>
        </div>
    );

    const renderResult = () => {
        const { userTotals, totalSubtotal } = calculateResults();
        const grandTotal = totalSubtotal + tax + serviceCharge - discount;

        return (
            <div className="p-6 pb-32 animate-fade-in">
                <div className="relative mb-8">
                    <button
                        onClick={() => setStep('assign')}
                        className="absolute left-0 top-1 p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-900">Bill Breakdown</h2>
                        <p className="text-slate-500">Here's what everyone owes.</p>
                    </div>
                </div>

                <Card className="p-6 mb-8 bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-xl shadow-indigo-200">
                    <div className="flex justify-between items-center mb-2 opacity-90">
                        <span className="text-indigo-100 font-medium">Total Bill</span>
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setIsEditing(true)}
                                className="bg-white/20 p-1.5 rounded-lg hover:bg-white/30 transition-colors active:scale-95"
                                title="Edit Bill Details"
                            >
                                <Edit2 size={16} className="text-white" />
                            </button>
                            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">{items.length} items</span>
                        </div>
                    </div>
                    <div className="text-4xl font-bold mb-6">{formatCurrency(grandTotal)}</div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20 text-sm opacity-90">
                        <div>
                            <span className="block text-indigo-200 text-xs">Tax</span>
                            <span className="font-semibold">{formatCurrency(tax)}</span>
                        </div>
                        <div>
                            <span className="block text-indigo-200 text-xs">Service</span>
                            <span className="font-semibold">{formatCurrency(serviceCharge)}</span>
                        </div>
                    </div>
                </Card>

                <div className="space-y-4">
                    {users.map(user => {
                        const data = userTotals[user.id];
                        if (data.total === 0) return null;

                        // Filter items for this user
                        const userItems = items.filter(item => item.assignedTo.includes(user.id));

                        return (
                            <Card key={user.id} className="p-5">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${user.color.split(' ')[0]} ${user.color.split(' ')[1]}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-slate-800 text-lg">{user.name}</span>
                                    </div>
                                    <span className="text-xl font-bold text-indigo-600">{formatCurrency(data.total)}</span>
                                </div>

                                {/* Items List */}
                                <div className="mb-4 space-y-2 border-b border-slate-100 pb-4">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Items</p>
                                    {userItems.map(item => (
                                        <div key={item.id} className="flex justify-between text-sm text-slate-700">
                                            <div className="flex flex-col">
                                                <span>{item.name}</span>
                                                {item.assignedTo.length > 1 && (
                                                    <span className="text-[10px] text-slate-400">
                                                        Split {item.assignedTo.length} ways
                                                    </span>
                                                )}
                                            </div>
                                            <span>{formatCurrency(item.price / item.assignedTo.length)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-xl">
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(data.subtotal)}</span>
                                    </div>
                                    {(data.taxShare > 0 || data.serviceShare > 0) && (
                                        <div className="flex justify-between text-xs">
                                            <span>Tax & Service</span>
                                            <span>+{formatCurrency(data.taxShare + data.serviceShare)}</span>
                                        </div>
                                    )}
                                    {data.discountShare > 0 && (
                                        <div className="flex justify-between text-emerald-600 text-xs font-medium">
                                            <span>Discount</span>
                                            <span>-{formatCurrency(data.discountShare)}</span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 max-w-md mx-auto flex flex-col gap-3">
                    <Button onClick={generatePDF} fullWidth icon={Download} className="bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200">
                        Export PDF
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => setStep('upload')} className="flex-1">
                            New Scan
                        </Button>
                        <Button variant="outline" onClick={saveBill} className="flex-1" icon={Save}>
                            Save
                        </Button>
                        <Button variant="primary" className="flex-1" icon={Share2}>
                            Share
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-slate-50 max-w-md mx-auto shadow-2xl overflow-hidden relative font-sans text-slate-900">
                {step !== 'upload' && !isLoading && <StepIndicator currentStep={step} />}

                {step === 'upload' && renderUpload()}
                {step === 'users' && renderUsers()}
                {step === 'assign' && renderAssign()}
                {step === 'result' && renderResult()}
                {renderEditModal()}
            </div>
        </ErrorBoundary>
    );
}
