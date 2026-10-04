<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Purchase Order', to: '/purchase/orders' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Purchase Order" />
    <PoForm />
  </div>
</template>
