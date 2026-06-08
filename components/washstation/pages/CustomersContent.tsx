'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCustomers } from '@/hooks/useCustomers';
import { useOrders } from '@/context/OrderContext';
import { 
  Search,
  Plus,
  Phone,
  Mail,
  Edit,
  Eye,
  ArrowRight,
  User,
  Award,
  FileText,
  Tag,
  PhoneCall,
  MessageCircle
} from 'lucide-react';

export function CustomersContent() {
  const router = useRouter();
  const { customers, findByPhone } = useCustomers();
  const { orders } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [foundByCard, setFoundByCard] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFoundByCard(false);

    // Strip spaces so "055 288 7039" and "0552887039" both match
    const cleanQuery = query.replace(/\s/g, '');

    if (cleanQuery.length >= 1) {
      const orderByCard = orders.find(o =>
        o.bagCardNumber === cleanQuery ||
        o.bagCardNumber === cleanQuery.replace('#', '')
      );

      if (orderByCard) {
        const customer = findByPhone(orderByCard.customerPhone);
        setSelectedCustomer({
          ...customer,
          linkedOrder: orderByCard,
          name: customer?.name || orderByCard.customerName,
          phone: customer?.phone || orderByCard.customerPhone
        });
        setFoundByCard(true);
        return;
      }

      if (cleanQuery.length >= 3) {
        const found = findByPhone(cleanQuery);
        setSelectedCustomer(found || null);
      } else {
        setSelectedCustomer(null);
      }
    } else {
      setSelectedCustomer(null);
    }
  };

  const handleNewOrder = (customerId: string) => {
    sessionStorage.setItem('rapidwash_prefilledCustomer', JSON.stringify({
      id: selectedCustomer.id || selectedCustomer._id,
      name: selectedCustomer.name,
      phone: selectedCustomer.phone || selectedCustomer.phoneNumber,
      email: selectedCustomer.email,
      skipPhone: true
    }));
    router.push('/washstation/new-order');
  };

  const mockOrders = [
    { id: 'ORD-9281', date: 'Oct 12, 2023', items: '3x Wash & Fold (L)', total: 45.00, status: 'Completed' },
    { id: 'ORD-8842', date: 'Sep 28, 2023', items: '1x Comforter (K)', total: 22.50, status: 'Completed' },
    { id: 'ORD-7210', date: 'Aug 15, 2023', items: '2x Wash & Fold (M)', total: 30.00, status: 'Completed' },
  ];

  return (
    <>
      {/* Search Header */}
      <div className="mb-6">
        <p className="text-muted-foreground mb-4">
          Search by phone, name, or <span className="text-primary font-medium">bag card number</span> to find a customer.
        </p>
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search customer or enter card number (e.g. #001)..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-12 pr-12 py-4 text-lg rounded-xl"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedCustomer(null); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Found by Card Banner */}
      {foundByCard && selectedCustomer?.linkedOrder && (
        <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6 text-success flex-shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                Card #{selectedCustomer.linkedOrder.bagCardNumber} Found!
              </p>
              <p className="text-sm text-muted-foreground">
                Order {selectedCustomer.linkedOrder.code} • Status: {selectedCustomer.linkedOrder.status}
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push(`/washstation/orders/${selectedCustomer.linkedOrder.id}`)}
            className="gap-2 w-full sm:w-auto"
          >
            View Order
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Customer Profile Card */}
      {selectedCustomer ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-foreground">{selectedCustomer.name}</h2>
                    {(selectedCustomer.totalOrders || 0) > 10 && (
                      <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded-full flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        GOLD
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {selectedCustomer.phone}
                    </span>
                    {selectedCustomer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {selectedCustomer.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                {selectedCustomer.phone && (
                  <Button
                    variant="outline"
                    className="gap-2 flex-1 sm:flex-initial text-green-600 border-green-200"
                    onClick={() => { window.location.href = `tel:${selectedCustomer.phone || selectedCustomer.phoneNumber}`; }}
                  >
                    <PhoneCall className="w-4 h-4" />
                    Call
                  </Button>
                )}
                {selectedCustomer.phone && (
                  <Button
                    variant="outline"
                    className="gap-2 flex-1 sm:flex-initial text-green-600 border-green-200"
                    onClick={() => {
                      const p = (selectedCustomer.phone || selectedCustomer.phoneNumber || '').replace(/\D/g, '');
                      const phone = p.startsWith('0') ? `233${p.slice(1)}` : p;
                      window.open(`https://wa.me/${phone}`, '_blank');
                    }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </Button>
                )}
                <Button variant="outline" className="gap-2 flex-1 sm:flex-initial">
                  <Edit className="w-4 h-4" />
                  Edit Profile
                </Button>
                <Button
                  onClick={() => handleNewOrder(selectedCustomer.id)}
                  className="bg-primary text-primary-foreground gap-2 flex-1 sm:flex-initial"
                >
                  <Plus className="w-4 h-4" />
                  New Order
                </Button>
              </div>
            </div>
          </div>

          {/* Customer Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border">
            
            <div className="p-5 border-r border-border">
              <p className="text-sm text-muted-foreground">Last Visit</p>
              <p className="text-lg font-bold text-foreground mt-1">
                {selectedCustomer.lastVisit || selectedCustomer.lastOrderDate
                    ? new Date(selectedCustomer.lastVisit || selectedCustomer.lastOrderDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'No visits yet'}
              </p>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm text-foreground mt-1 italic line-clamp-2">
                {selectedCustomer.notes || '"Allergic to lavender detergent. Prefer..."'}
              </p>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Orders</h3>
              <button className="text-sm text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase">Order ID</th>
                    <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase">Items</th>
                    <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase">Total</th>
                    <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockOrders.map(order => (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium text-foreground">{order.id}</td>
                      <td className="py-3 text-muted-foreground">{order.date}</td>
                      <td className="py-3 text-muted-foreground">{order.items}</td>
                      <td className="py-3 font-medium text-foreground">₵{order.total.toFixed(2)}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-success/10 text-success text-xs rounded-full">
                          ● {order.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : searchQuery.length >= 3 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Customer Found</h3>
          <p className="text-muted-foreground mb-6">Would you like to create a new customer profile?</p>
          <Button
            onClick={() => router.push('/washstation/new-order')}
            className="bg-primary text-primary-foreground gap-2"
          >
            <Plus className="w-4 h-4" />
            Create New Customer
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Search for a Customer</h3>
          <p className="text-muted-foreground">Enter a phone number, name, or email to find a customer profile</p>
          <p className="text-sm text-muted-foreground mt-4">
            <FileText className="w-4 h-4 inline mr-1" />
            Can't find them? Create a new customer profile
          </p>
        </div>
      )}
    </>
  );
}