import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { insertTripSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { formatDateForInput } from "@/lib/utils";
import { AirportInput } from "@/components/ui/airport-input";

// Regular expression to validate IATA airport codes (3 uppercase letters) or full airport names
const airportCodeRegex =
  /^([A-Z]{3}|\w+[\w\s-]*\s*(international|airport|intl).*)$/i;

// Extend the insertTripSchema to add validation
const formSchema = insertTripSchema.extend({
  departureAirport: z
    .string()
    .min(3, "Airport code must be at least 3 characters")
    .refine((value) => airportCodeRegex.test(value), {
      message:
        "Please enter a valid airport code (e.g., JFK, LAX) or full airport name",
    })
    .optional(),
  departureDate: z
    .string()
    .refine((date) => {
    const selected = new Date(date + "T00:00:00");
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    return selected.getTime() >= todayUTC.getTime();
  }, "Departure date must be today or in the future")

    .optional(),
  arrivalDate: z
    .string()
    .refine((date) => {
    const selected = new Date(date + "T00:00:00");
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    return selected.getTime() >= todayUTC.getTime();
    }, "Arrival date must be today or in the future")
    .optional(),
  terms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
});

type TripFormValues = z.infer<typeof formSchema>;

export function TravelerForm() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [location, setLocation] = useLocation(); // Added useLocation hook

  // Default values for the form
  const defaultValues: Partial<TripFormValues> = {
    departureAirport: "",
    destinationCity: "Addis Ababa",
    departureDate: formatDateForInput(new Date()),
    arrivalDate: formatDateForInput(new Date(Date.now() + 86400000)), // Tomorrow
    availableWeight: 5,
    pricePerKg: 15,
    notes: "",
    terms: false,
  };

  const form = useForm<TripFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const tripMutation = useMutation({
    mutationFn: async (data: TripFormValues) => {
      // Convert date strings to ISO format
      const formattedData = {
        ...data,
        departureDate: new Date(data.departureDate).toISOString(),
        arrivalDate: new Date(data.arrivalDate).toISOString(),
      };
      const res = await apiRequest("POST", "/api/trips", formattedData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Trip posted successfully",
        description:
          "Your trip has been posted and is now visible to package senders.",
      });
      form.reset(defaultValues);
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips/user"] });
      setLocation("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Failed to post trip",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSubmitting(false);
    },
  });

  function onSubmit(values: TripFormValues) {
    if (!values.departureAirport) {
      toast({
        title: "Flight details required",
        description: "Please enter flight details",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    // Create a copy of values with proper date conversions and validation
    const departureDate = new Date(values.departureDate);
    const arrivalDate = new Date(values.arrivalDate);

    // Validate that departure is not before today and arrival not before departure
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (departureDate < today) {
      toast({
        title: "Invalid departure date",
        description: "Departure date cannot be in the past",
        variant: "destructive",
      });
      return;
    }

    if (arrivalDate < departureDate) {
      toast({
        title: "Invalid arrival date",
        description: "Arrival date must be after departure date",
        variant: "destructive",
      });
      return;
    }

    try {
      const departureDateObj = new Date(values.departureDate);
      const arrivalDateObj = new Date(values.arrivalDate);

      if (
        isNaN(departureDateObj.getTime()) ||
        isNaN(arrivalDateObj.getTime())
      ) {
        toast({
          title: "Invalid date format",
          description: "Please ensure dates are in valid format",
          variant: "destructive",
        });
        return;
      }

      // Ensure dates are valid
      if (
        !departureDateObj ||
        !arrivalDateObj ||
        isNaN(departureDateObj.getTime()) ||
        isNaN(arrivalDateObj.getTime())
      ) {
        toast({
          title: "Invalid dates",
          description: "Please enter valid departure and arrival dates",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Set time to noon UTC to avoid timezone issues
      departureDateObj.setUTCHours(12, 0, 0, 0);
      arrivalDateObj.setUTCHours(12, 0, 0, 0);

            const formatToUTCDate = (d: Date) => {
          const dateOnly = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
          return dateOnly.toISOString();
        };

        const formattedValues = {
          ...values,
          departureDate: formatToUTCDate(departureDateObj),
          arrivalDate: formatToUTCDate(arrivalDateObj),
          availableWeight: Number(values.availableWeight),
          pricePerKg: Number(values.pricePerKg),
        };


      tripMutation.mutate(formattedValues);
    } catch (error) {
      toast({
        title: "Form submission error",
        description:
          error instanceof Error ? error.message : "Failed to submit form",
        variant: "destructive",
      });
    }
  }

  return (
  <div>
    <h3 className="text-xl font-semibold text-gray-900 mb-6">
      Post Your Flight Details
    </h3>

    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          {/* Flight Details Section */}
          <div className="sm:col-span-6 space-y-4">
            <h4 className="font-medium text-gray-800">Flight Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Flight Number */}
              <FormField
                control={form.control}
                name="flightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. ET507"
                        className="uppercase"
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Departure Date */}
              <FormField
                control={form.control}
                name="departureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departure Date</FormLabel>
                    <FormControl>
                     <Input
                      type="date"
                      min={formatDateForInput(new Date())} // ⬅ ensures only today or future dates selectable
                      {...field}
                      onChange={(e) => {
                        const date = e.target.value;
                        field.onChange(date);
                        const depDate = new Date(date);
                        depDate.setDate(depDate.getDate() + 1);
                        form.setValue("arrivalDate", formatDateForInput(depDate));
                      }}
                    />

                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Arrival Date */}
              <FormField
                control={form.control}
                name="arrivalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrival Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

                {/* Departure Airport */}
              <FormField
                control={form.control}
                name="departureAirport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departure Airport</FormLabel>
                    <FormControl>
                      <AirportInput
                        value={field.value ?? ""}
                        onChange={(value: string) => {
                          field.onChange(value);
                        }}
                      onSelectSuggestion={(airportCode: string) => {
                        field.onChange(airportCode);
                        form.trigger("departureAirport");
                      }}
                        placeholder="Enter airport code or name (e.g. JFK, Los Angeles)"
                        disabled={isLookingUp}
                      />
                    </FormControl>
                    <FormDescription>
                      Select from dropdown to ensure valid airport
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Destination City */}
              <FormField
                control={form.control}
                name="destinationCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination City</FormLabel>
                    <FormControl>
                      <Input {...field} disabled value="Addis Ababa" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Available Weight */}
              <FormField
                control={form.control}
                name="availableWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Weight (kg)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Price per kg */}
              <FormField
                control={form.control}
                name="pricePerKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per kg ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-6">
                <FormLabel>Additional Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Include any restrictions (e.g., no electronics, no food items)"
                    className="resize-none"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Terms and Conditions */}
          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem className="sm:col-span-6 flex flex-row items-start space-x-3 rounded-md p-4 border">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    I agree to the{" "}
                    <a
                      href="#"
                      className="text-primary-600 hover:text-primary-500"
                    >
                      terms and conditions
                    </a>
                  </FormLabel>
                  <FormDescription>
                    I confirm I have the space available and will handle all
                    customs requirements.
                  </FormDescription>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="mr-3"
            onClick={() => form.reset(defaultValues)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || tripMutation.isPending}
          >
            {submitting || tripMutation.isPending ? "Posting..." : "Post Trip"}
          </Button>
        </div>
      </form>
    </Form>
  </div>
);
}