import { useState, useEffect } from 'react';
import { Check, Clock, MapPin, CreditCard, Bell, Truck } from 'lucide-react';

interface Slide {
  title: string;
  content: React.ReactNode;
  bgClass: string;
}

const slides: Slide[] = [
  {
    title: 'Place Order',
    bgClass: 'from-blue-100 to-blue-50',
    content: (
      <div className="p-4 space-y-4">
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <span className="text-primary font-bold text-lg">W</span>
          </div>
          <p className="font-semibold text-foreground">Jarvis</p>
        </div>
        <p className="text-sm font-semibold text-foreground">Place Order</p>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service:</span>
            <span className="font-medium">Wash & Dry</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Items:</span>
            <span className="font-medium">12 pieces</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated:</span>
            <span className="font-medium text-primary">₵50</span>
          </div>
        </div>
        <button className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold mt-4">
          Continue
        </button>
      </div>
    ),
  },
  {
    title: 'Order Created',
    bgClass: 'from-emerald-100 to-emerald-50',
    content: (
      <div className="p-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <Check className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Order Created!</p>
          <p className="text-2xl font-bold text-foreground">WL-4921</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-left">
          <p className="text-xs text-muted-foreground mb-2">Next step:</p>
          <p className="text-sm font-medium">Bring your clothes to Jarvis</p>
          <p className="text-xs text-muted-foreground mt-1">Show this code at the counter</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Pay Instantly',
    bgClass: 'from-violet-100 to-violet-50',
    content: (
      <div className="p-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
          <CreditCard className="w-7 h-7 text-violet-600" />
        </div>
        <p className="text-sm font-semibold text-foreground">Payment Request</p>
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">USSD sent to:</p>
          <p className="font-mono font-semibold text-foreground">024 XXX XXXX</p>
          <div className="h-px bg-border my-3" />
          <p className="text-xs text-muted-foreground">Amount:</p>
          <p className="text-xl font-bold text-primary">₵50</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-amber-600">
          <Clock className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Awaiting payment...</span>
        </div>
      </div>
    ),
  },
  {
    title: 'In Progress',
    bgClass: 'from-amber-100 to-amber-50',
    content: (
      <div className="p-4 space-y-4">
        <p className="text-sm font-semibold text-foreground text-center">Order Status</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-sm font-medium">Sorting</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-sm font-medium">Washing</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <span className="text-sm font-medium text-amber-600">Drying</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
            </div>
            <span className="text-sm text-muted-foreground">Folding</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Ready!',
    bgClass: 'from-emerald-100 to-emerald-50',
    content: (
      <div className="p-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <Bell className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <p className="text-emerald-600 font-semibold">Order Ready!</p>
          <p className="text-2xl font-bold text-foreground">WL-4921</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-medium text-emerald-700">Your order is ready for pickup</p>
          <p className="text-xs text-emerald-600 mt-1">Bag #10</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Pickup / Delivery',
    bgClass: 'from-blue-100 to-blue-50',
    content: (
      <div className="p-4 space-y-4">
        <p className="text-sm font-semibold text-foreground text-center">Choose Option</p>
        <button className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5 text-left">
          <MapPin className="w-5 h-5 text-primary" />
          <div>
            <p className="font-medium text-foreground">Pickup at Jarvis</p>
            <p className="text-xs text-muted-foreground">Main Campus • Open now</p>
          </div>
        </button>
        <button className="w-full flex items-center gap-3 p-4 rounded-xl border border-border text-left hover:border-primary/50 transition-colors">
          <Truck className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Deliver to my hall</p>
            <p className="text-xs text-muted-foreground">+₵5 delivery fee</p>
          </div>
        </button>
      </div>
    ),
  },
];

export const PhoneSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Phone Frame */}
      <div className="relative mx-auto w-[280px] h-[560px]">
        {/* Phone bezel */}
        <div className="absolute inset-0 bg-foreground rounded-[3rem] shadow-2xl shadow-primary/20" />
        
        {/* Phone screen area */}
        <div className="absolute inset-[8px] bg-background rounded-[2.5rem] overflow-hidden">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground rounded-b-2xl z-10" />
          
          {/* Screen content */}
          <div className={`h-full pt-8 bg-gradient-to-b ${slides[currentSlide].bgClass} transition-colors duration-500`}>
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 pt-10 transition-all duration-500 ${
                  index === currentSlide
                    ? 'opacity-100 translate-x-0'
                    : index < currentSlide
                    ? 'opacity-0 -translate-x-full'
                    : 'opacity-0 translate-x-full'
                }`}
              >
                {slide.content}
              </div>
            ))}
          </div>
          
          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-foreground/20 rounded-full" />
        </div>
      </div>
      
      {/* Slide indicators */}
      <div className="flex justify-center gap-2 mt-6">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 rounded-full transition-all ${
              index === currentSlide
                ? 'w-8 bg-primary'
                : 'w-2 bg-primary/30 hover:bg-primary/50'
            }`}
          />
        ))}
      </div>
      
      {/* Slide title */}
      <p className="text-center text-sm text-muted-foreground mt-4">
        {slides[currentSlide].title}
      </p>
    </div>
  );
};
