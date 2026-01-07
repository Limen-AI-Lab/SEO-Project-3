
import React, { useState, useEffect } from 'react';
import { Client, ClientFeedbackHistory, Contact } from '../types';
import { getClientFeedbackHistory } from '../services/store';
import { getAllClientsWithContacts, createContact, deleteContact as deleteContactService, updateContact } from '../services/clientService';
import supabase from '../services/supabaseClient.js';
import { Search, Plus, Trash2, Edit2, User, Building, Mail, Phone, Globe, Mic, AlertCircle, X, Save, Sparkles, History, ChevronDown, ChevronUp, Quote, MessageCircle, Users } from 'lucide-react';

const ClientManagement: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // Feedback History State
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyData, setHistoryData] = useState<ClientFeedbackHistory[]>([]);

  // Form State
  const [formData, setFormData] = useState<Partial<Client>>({});
  
  // Contact Person State
  const [contactsExpanded, setContactsExpanded] = useState(true);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Helper function to refetch clients with contacts from Supabase
  const refetchClients = async () => {
    try {
      const clientsWithContacts = await getAllClientsWithContacts();
      setClients(clientsWithContacts);
    } catch (err) {
      console.error('Unexpected error fetching clients:', err);
    }
  };

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const clientsWithContacts = await getAllClientsWithContacts();
        setClients(clientsWithContacts);
      } catch (err) {
        console.error('Unexpected error fetching clients:', err);
        alert('Failed to fetch client list. Please refresh the page and try again.');
      }
    };

    fetchClients();
  }, []);

  // Load history when opening edit modal
  useEffect(() => {
    if (editingClient) {
      setHistoryData(getClientFeedbackHistory(editingClient.id));
    } else {
      setHistoryData([]);
    }
  }, [editingClient]);

  // Handle adding a new contact
  const handleAddContact = async () => {
    if (!editingClient || !newContactName.trim() || !newContactEmail.trim()) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newContactEmail)) {
      setContactError('Please enter a valid email address.');
      return;
    }
    
    setIsAddingContact(true);
    setContactError(null);
    
    try {
      const newContact = await createContact(editingClient.id, newContactName, newContactEmail);
      if (newContact) {
        // Update the editing client's contacts locally
        const updatedContacts = [...(editingClient.contacts || []), newContact];
        setEditingClient({ ...editingClient, contacts: updatedContacts });
        
        // Update the clients list
        setClients(clients.map(c => 
          c.id === editingClient.id ? { ...c, contacts: updatedContacts } : c
        ));
        
        // Clear form
        setNewContactName('');
        setNewContactEmail('');
      }
    } catch (err: any) {
      setContactError(err.message || 'Failed to add contact.');
    } finally {
      setIsAddingContact(false);
    }
  };

  // Handle deleting a contact
  const handleDeleteContact = async (contactId: string) => {
    if (!editingClient) return;
    if (!confirm('Are you sure you want to delete this contact? They will no longer be able to access the Client Portal.')) return;
    
    try {
      await deleteContactService(contactId);
      
      // Update the editing client's contacts locally
      const updatedContacts = (editingClient.contacts || []).filter(c => c.id !== contactId);
      setEditingClient({ ...editingClient, contacts: updatedContacts });
      
      // Update the clients list
      setClients(clients.map(c => 
        c.id === editingClient.id ? { ...c, contacts: updatedContacts } : c
      ));
    } catch (err: any) {
      alert(err.message || 'Failed to delete contact.');
    }
  };

  const openModal = (client?: Client) => {
    setHistoryExpanded(false); // Reset collapse state
    setContactsExpanded(true); // Expand contacts section by default
    setNewContactName('');
    setNewContactEmail('');
    setContactError(null);
    
    if (client) {
      setEditingClient(client);
      setFormData({ ...client });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        industry: '',
        website: '',
        contactPerson: '',
        email: '',
        phone: '',
        defaultTone: '',
        defaultRules: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting client:', error);
        alert(`Failed to delete client: ${error.message}`);
        return;
      }

      await refetchClients();
    } catch (err) {
      console.error('Unexpected error deleting client:', err);
      alert(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert("Client Name is required.");
      return;
    }

    try {
    if (editingClient) {
        // Update existing client
        const { data, error } = await supabase
          .from('clients')
          .update({
            name: formData.name,
            tone_of_voice: formData.defaultTone || null,
            strict_rules: formData.defaultRules || null
          })
          .eq('id', editingClient.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating client:', error);
          alert(`Failed to update client: ${error.message}`);
          return;
        }

        if (data) {
          await refetchClients();
        }
    } else {
        // Create new client - get current user ID for RLS
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          alert('User not authenticated. Please log in again.');
          return;
        }

        const { data, error } = await supabase
          .from('clients')
          .insert({
            name: formData.name,
            tone_of_voice: formData.defaultTone || null,
            strict_rules: formData.defaultRules || null,
            user_id: user.id
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating client:', error);
          alert(`Failed to create client: ${error.message}`);
          return;
        }

        if (data) {
          await refetchClients();
        }
      }

    setIsModalOpen(false);
    } catch (err) {
      console.error('Unexpected error saving client:', err);
      alert(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Client Management</h1>
          <p className="text-slate-500 mt-2">Manage customer profiles and content preferences.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-md"
        >
          <Plus size={18} />
          Add Client
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">All Clients</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clients..." 
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4">Client Name</th>
                <th className="px-6 py-4">Industry / Business</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">AI Preferences</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                          {client.name.charAt(0)}
                       </div>
                       {client.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                       <span>{client.industry || '-'}</span>
                       {client.website && <a href={client.website} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-1"><Globe size={10} /> {client.website}</a>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {(client.contacts?.length ?? 0) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-indigo-500"/>
                          <span className="text-sm font-medium text-indigo-600">{client.contacts?.length} Contact{(client.contacts?.length ?? 0) > 1 ? 's' : ''}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm italic">No contacts</span>
                      )}
                      {(client.contacts?.length ?? 0) > 0 && (
                        <div className="text-xs text-slate-500">
                          {client.contacts?.slice(0, 2).map(c => c.email).join(', ')}
                          {(client.contacts?.length ?? 0) > 2 && '...'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     {client.defaultTone || client.defaultRules ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                           <Sparkles size={10} /> Configured
                        </span>
                     ) : (
                        <span className="text-slate-400 text-xs">Default</span>
                     )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={() => openModal(client)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition"><Edit2 size={16} /></button>
                       <button onClick={() => handleDelete(client.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                 <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                       No clients found matching "{searchTerm}".
                    </td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
              <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div>
                    <h3 className="text-xl font-bold text-slate-900">{editingClient ? 'Edit Client Profile' : 'Add New Client'}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Configure company details and AI content memory.</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition"><X size={24} /></button>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
                 {/* Section 1: Company Info */}
                 <section>
                    <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                       <Building size={18} className="text-indigo-600"/> Company Details
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Client Name *</label>
                          <input 
                            type="text" 
                            value={formData.name || ''}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. Acme Corp"
                          />
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Industry / Sector</label>
                          <input 
                            type="text" 
                            value={formData.industry || ''}
                            onChange={e => setFormData({...formData, industry: e.target.value})}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. FinTech"
                          />
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Website URL</label>
                          <div className="relative">
                             <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                             <input 
                               type="text" 
                               value={formData.website || ''}
                               onChange={e => setFormData({...formData, website: e.target.value})}
                               className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                               placeholder="https://..."
                             />
                          </div>
                       </div>
                    </div>
                 </section>

                 {/* Section 2: Contact Persons (Multiple) */}
                 <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <button 
                       onClick={() => setContactsExpanded(!contactsExpanded)} 
                       className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition focus:outline-none"
                    >
                       <div className="flex items-center gap-2 font-bold text-slate-700">
                          <Users size={18} className="text-indigo-600" />
                          Contact Persons (Portal Access)
                          {editingClient?.contacts && editingClient.contacts.length > 0 && (
                            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full ml-2">
                               {editingClient.contacts.length} Contact{editingClient.contacts.length > 1 ? 's' : ''}
                            </span>
                          )}
                       </div>
                       {contactsExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>
                    
                    {contactsExpanded && (
                       <div className="p-4 bg-slate-50/50 border-t border-slate-200 space-y-4">
                          <p className="text-xs text-slate-500 mb-3">
                             Add contact persons who will have access to the Client Portal. Each contact can log in using their email address to review and approve content.
                          </p>
                          
                          {/* Existing Contacts List */}
                          {editingClient?.contacts && editingClient.contacts.length > 0 ? (
                            <div className="space-y-2 mb-4">
                               {editingClient.contacts.map(contact => (
                                  <div key={contact.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between group hover:border-indigo-200 transition">
                                     <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold">
                                           {contact.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                           <div className="text-sm font-medium text-slate-800">{contact.name}</div>
                                           <div className="text-xs text-slate-500 flex items-center gap-1">
                                              <Mail size={10} />
                                              {contact.email}
                                           </div>
                                        </div>
                                     </div>
                                     <button 
                                        onClick={() => handleDeleteContact(contact.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100"
                                        title="Remove contact"
                                     >
                                        <Trash2 size={14} />
                                     </button>
                                  </div>
                               ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-slate-400 text-sm italic border border-dashed border-slate-200 rounded-lg mb-4">
                               No contacts added yet. Add a contact below.
                            </div>
                          )}
                          
                          {/* Add New Contact Form */}
                          {editingClient && (
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                               <h5 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                                  <Plus size={14} /> Add New Contact
                               </h5>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                       <div>
                                     <label className="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
                          <input 
                            type="text" 
                                       value={newContactName}
                                       onChange={e => setNewContactName(e.target.value)}
                                       className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            placeholder="Jane Doe"
                          />
                       </div>
                       <div>
                                     <label className="block text-xs font-medium text-slate-600 mb-1">Email Address</label>
                          <div className="relative">
                                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                             <input 
                               type="email" 
                                          value={newContactEmail}
                                          onChange={e => { setNewContactEmail(e.target.value); setContactError(null); }}
                                          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                               placeholder="jane@company.com"
                             />
                          </div>
                       </div>
                               </div>
                               
                               {contactError && (
                                  <div className="flex items-center gap-2 text-red-600 text-xs mb-3">
                                     <AlertCircle size={12} />
                                     {contactError}
                                  </div>
                               )}
                               
                               <button 
                                  onClick={handleAddContact}
                                  disabled={!newContactName.trim() || !newContactEmail.trim() || isAddingContact}
                                  className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                               >
                                  {isAddingContact ? (
                                     <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                                        Adding...
                                     </>
                                  ) : (
                                     <>
                                        <Plus size={16} />
                                        Add Contact Person
                                     </>
                                  )}
                               </button>
                            </div>
                          )}
                          
                          {!editingClient && (
                            <div className="text-center py-4 text-amber-600 text-sm bg-amber-50 rounded-lg border border-amber-200">
                               <AlertCircle size={16} className="inline mr-2" />
                               Save the client first, then you can add contact persons.
                          </div>
                          )}
                       </div>
                    )}
                 </section>

                 {/* Section 3: AI Preferences */}
                 <section className="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
                    <h4 className="flex items-center gap-2 font-bold text-indigo-900 mb-4">
                       <Mic size={18} className="text-indigo-600"/> AI Content Memory (Inheritance)
                    </h4>
                    <div className="space-y-4">
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Default Tone of Voice</label>
                          <input 
                            type="text" 
                            value={formData.defaultTone || ''}
                            onChange={e => setFormData({...formData, defaultTone: e.target.value})}
                            className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. Professional, Authoritative, yet Accessible"
                          />
                          <p className="text-xs text-slate-500 mt-1">This will automatically pre-fill the Tone field when generating content for this client.</p>
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Saved Strict Content Rules</label>
                          <textarea 
                            value={formData.defaultRules || ''}
                            onChange={e => setFormData({...formData, defaultRules: e.target.value})}
                            className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                            placeholder="e.g. Always use British English. Never mention competitors."
                          />
                          <p className="text-xs text-slate-500 mt-1">These rules will persist across all campaigns for this client.</p>
                       </div>
                    </div>
                 </section>

                 {/* NEW SECTION: Historical Feedback Log */}
                 <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <button 
                       onClick={() => setHistoryExpanded(!historyExpanded)} 
                       className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition focus:outline-none"
                    >
                       <div className="flex items-center gap-2 font-bold text-slate-700">
                          <History size={18} className="text-indigo-600" />
                          Historical Feedback Log (Learning Data)
                          {historyData.length > 0 && (
                            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full ml-2">
                               {historyData.length} Records
                            </span>
                          )}
                       </div>
                       {historyExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                    </button>
                    
                    {historyExpanded && (
                       <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                          {historyData.length === 0 ? (
                             <p className="text-center text-slate-400 text-sm italic py-4">No historical feedback recorded for this client.</p>
                          ) : (
                             historyData.map(item => (
                                <div key={item.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition">
                                   <div className="flex items-start gap-3 mb-3">
                                      <Quote size={16} className="text-slate-300 flex-shrink-0 mt-1" />
                                      <p className="text-sm text-slate-500 italic border-l-2 border-slate-200 pl-3 leading-relaxed">
                                         "{item.quotedContext}"
                                      </p>
                                   </div>
                                   <div className="flex items-start gap-3 mb-3">
                                      <MessageCircle size={16} className="text-amber-500 flex-shrink-0 mt-1" />
                                      <p className="text-sm font-semibold text-slate-800 leading-snug">
                                         {item.commentText}
                                      </p>
                                   </div>
                                   <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-50">
                                      <span className="bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">{item.campaignName}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="text-indigo-600 hover:underline cursor-pointer flex items-center gap-1">
                                         {item.articleTitle}
                                      </span>
                                      <span className="ml-auto flex-shrink-0">{item.timestamp.toLocaleDateString()}</span>
                                   </div>
                                </div>
                             ))
                          )}
                       </div>
                    )}
                 </section>

              </div>

              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                 <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-medium hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition">Cancel</button>
                 <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition">
                    <Save size={18} /> Save Client Profile
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ClientManagement;