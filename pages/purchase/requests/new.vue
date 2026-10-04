<template>
  <div>
    <BaseBreadcrumb :items="[{ label: 'Purchase', to: '/purchase/requests' }, { label: 'Product Request', to: '/purchase/requests' }, { label: 'Buat Baru' }]" />
    <BasePageHeader title="Buat Product Request" />
    <RequestForm />
  </div>
</template>
