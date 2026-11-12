import { useState } from 'react'
import { Phone, Mail, MapPin, MessageCircle, CheckCircle } from 'lucide-react'
import { SITE } from '../config/site'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [emailDraftOpened, setEmailDraftOpened] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(`ARENA X enquiry from ${form.name}`)
    const body = encodeURIComponent(`${form.message}\n\nReply to: ${form.name} <${form.email}>\nPhone: ${form.phone}`)
    window.location.href = `mailto:${SITE.contact.email}?subject=${subject}&body=${body}`
    setEmailDraftOpened(true)
  }

  return (
    <div className="pt-16 min-h-screen">
      {/* Header */}
      <section className="bg-[#0d0d0d] border-b border-gray-800 py-12 px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lime-500 text-sm font-bold uppercase tracking-widest mb-2">Get in Touch</p>
          <h1 className="text-4xl font-black text-white mb-3">Contact Us</h1>
          <p className="text-gray-400 max-w-lg mx-auto text-sm">
            Have a question? Want to book a large group? We're here to help.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Contact info */}
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Our Details</h2>
            <div className="space-y-5">
              {[
                { icon: Phone, label: 'Phone', value: SITE.contact.phone, href: `tel:${SITE.contact.phone}` },
                { icon: MessageCircle, label: 'WhatsApp', value: SITE.contact.whatsapp, href: `https://wa.me/${SITE.contact.whatsapp.replace(/\D/g, '')}` },
                { icon: Mail, label: 'Email', value: SITE.contact.email, href: `mailto:${SITE.contact.email}` },
                { icon: MapPin, label: 'Address', value: SITE.contact.address, href: SITE.contact.mapLink },
              ].map(({ icon: Icon, label, value, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-4 bg-card rounded-xl border border-gray-800 hover:border-lime-500/40 transition group"
                >
                  <div className="w-10 h-10 bg-lime-500/10 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-lime-500/20 transition">
                    <Icon size={18} className="text-lime-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-white text-sm font-medium">{value}</p>
                  </div>
                </a>
              ))}
            </div>

            {/* Map */}
            <div className="mt-6 rounded-xl overflow-hidden border border-gray-800 h-48">
              <iframe
                src={SITE.contact.mapEmbed}
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg)' }}
                allowFullScreen
                loading="lazy"
                title="Map"
              />
            </div>
          </div>

          {/* Form */}
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Send Us a Message</h2>
            {emailDraftOpened ? (
              <div className="flex flex-col items-center justify-center gap-4 h-64 text-center bg-card rounded-xl border border-gray-800 p-8">
                <CheckCircle size={48} className="text-lime-500" />
                <div>
                  <p className="font-bold text-white text-lg mb-1">Email draft opened</p>
                  <p className="text-gray-400 text-sm">Finish sending the message in your email app. You can also email {SITE.contact.email} directly.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { key: 'name', label: 'Your Name', type: 'text', placeholder: 'Rahul Sharma' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'rahul@example.com' },
                  { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210' },
                ].map(field => (
                  <div key={field.key}>
                    <label htmlFor={`contact-${field.key}`} className="block text-sm text-gray-400 mb-1">{field.label}</label>
                    <input
                      id={`contact-${field.key}`}
                      type={field.type}
                      required
                      placeholder={field.placeholder}
                      value={(form as any)[field.key]}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 focus:border-lime-500 rounded-lg px-4 py-2.5 text-white text-sm outline-none transition placeholder-gray-500"
                    />
                  </div>
                ))}
                <div>
                  <label htmlFor="contact-message" className="block text-sm text-gray-400 mb-1">Message</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    placeholder="Tell us how we can help…"
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-lime-500 rounded-lg px-4 py-2.5 text-white text-sm outline-none transition placeholder-gray-500 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={false}
                  className="w-full bg-lime-500 hover:bg-lime-400 disabled:bg-gray-700 text-black font-bold py-3 rounded-lg transition text-sm flex items-center justify-center gap-2"
                >
                  Send Email
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

